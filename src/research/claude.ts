// Claude calls for research runs: structured output through a forced tool call,
// streamed so long outputs never hit the request timeout, with usage logged per call.
import type Anthropic from '@anthropic-ai/sdk'
import { costUsd, type Usage } from '../../packages/core/src/models'
import { assertUnderCap, logUsage } from '../../netlify/functions/_shared/claude'

export type CallCtx = {
  claude: Anthropic
  model: string
  workspaceId: string
  clientId: string
  system: string
  onCost: (usd: number) => void
}

type ToolCallArgs = {
  content: Anthropic.ContentBlockParam[] | string
  toolName: string
  schema: Record<string, unknown>
  maxTokens: number
  webSearch?: { maxUses: number }
}

// Sends one request and returns the input of the output tool.
// Some models (Sonnet 5.5) reject a forced tool_choice, so the tool is offered with tool_choice auto
// and Claude is told to call it. If it answers in text instead, it is asked once more.
// Paused server-tool turns (web search) are continued.
export async function toolCall<T>(ctx: CallCtx, args: ToolCallArgs): Promise<T> {
  await assertUnderCap(ctx.workspaceId)
  const tools: Anthropic.ToolUnion[] = [
    { name: args.toolName, description: 'Return the result.', input_schema: args.schema as Anthropic.Tool.InputSchema },
  ]
  if (args.webSearch) tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: args.webSearch.maxUses })

  const ask: Anthropic.TextBlockParam = { type: 'text', text: `Finish by calling the ${args.toolName} tool with your result. Do not answer in plain text.` }
  const content: Anthropic.ContentBlockParam[] = typeof args.content === 'string' ? [{ type: 'text', text: args.content }, ask] : [...args.content, ask]
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content }]
  for (let turn = 0; turn < 4; turn++) {
    const res = await ctx.claude.messages
      .stream({
        model: ctx.model,
        max_tokens: args.maxTokens,
        system: [{ type: 'text', text: ctx.system, cache_control: { type: 'ephemeral' } }],
        tools,
        tool_choice: { type: 'auto' },
        messages,
      })
      .finalMessage()

    const usage: Usage = { ...res.usage, web_searches: res.usage.server_tool_use?.web_search_requests ?? 0 }
    ctx.onCost(costUsd(ctx.model, usage))
    await logUsage({ workspaceId: ctx.workspaceId, clientId: ctx.clientId, purpose: 'research', model: ctx.model, usage })

    const out = res.content.find((b) => b.type === 'tool_use' && b.name === args.toolName)
    if (out && out.type === 'tool_use') return out.input as T
    if (res.stop_reason === 'max_tokens') throw new Error('Claude ran out of room before finishing. Try again with fewer pages.')
    // Paused server-tool turn, or Claude answered in text: continue and ask for the tool call.
    messages.push({ role: 'assistant', content: res.content as Anthropic.ContentBlockParam[] })
    if (res.stop_reason !== 'pause_turn') {
      messages.push({ role: 'user', content: `Now call the ${args.toolName} tool with your result.` })
      tools.splice(1) // no more searching
    }
  }
  throw new Error('Claude did not return a result.')
}
