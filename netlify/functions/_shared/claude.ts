import Anthropic from '@anthropic-ai/sdk';
import { costUsd, type Usage } from '../../../packages/core/src/models';
import { adminClient } from './supabase';
import { HttpError } from './http';

// Reads the workspace's Claude key from Supabase Vault (server only).
export async function claudeFor(workspaceId: string): Promise<Anthropic> {
  const { data, error } = await adminClient().rpc('get_anthropic_key', { ws: workspaceId });
  if (error) throw error;
  if (!data) throw new HttpError(400, 'Add your Claude API key in Settings first');
  return new Anthropic({ apiKey: data as string });
}

// Blocks new work once the monthly cap is reached (if the workspace asks for that).
export async function assertUnderCap(workspaceId: string) {
  const db = adminClient();
  const [{ data: ws }, { data: usage }] = await Promise.all([
    db.from('workspaces').select('monthly_cap_usd, stop_at_cap').eq('id', workspaceId).single(),
    db.from('usage_this_month').select('cost_usd').eq('workspace_id', workspaceId),
  ]);
  const spent = (usage ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  if (ws?.stop_at_cap && spent >= Number(ws.monthly_cap_usd)) {
    throw new HttpError(402, `Monthly cap of $${ws.monthly_cap_usd} reached. Raise it in Settings to continue.`);
  }
}

// One row per Claude call, so Settings can show spend by task.
export async function logUsage(args: {
  workspaceId: string;
  clientId?: string | null;
  purpose: string;
  model: string;
  usage: Usage;
  batch?: boolean;
}) {
  const u = args.usage;
  await adminClient().from('api_usage').insert({
    workspace_id: args.workspaceId,
    client_id: args.clientId ?? null,
    purpose: args.purpose,
    model: args.model,
    input_tokens: u.input_tokens,
    cached_tokens: (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
    output_tokens: u.output_tokens,
    batch: !!args.batch,
    cost_usd: costUsd(args.model, u, { batch: args.batch }),
  });
}

// One Claude call that must return structured JSON. Forces a single tool call so the
// output always matches the schema, and puts the client brief in a cached system block.
export async function jsonCall<T>(args: {
  claude: Anthropic
  model: string
  brief: string
  instruction: string
  toolName: string
  schema: Record<string, unknown>
  maxTokens?: number
}): Promise<{ data: T; usage: Usage }> {
  const res = await args.claude.messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 1500,
    system: [{ type: 'text', text: args.brief, cache_control: { type: 'ephemeral' } }],
    tools: [{ name: args.toolName, description: 'Return the result.', input_schema: args.schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: 'tool', name: args.toolName },
    messages: [{ role: 'user', content: args.instruction }],
  })
  const block = res.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') throw new HttpError(502, 'Claude did not return a result. Try again.')
  return { data: block.input as T, usage: res.usage }
}
