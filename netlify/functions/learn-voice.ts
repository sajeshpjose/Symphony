// POST /api/learn-voice  { clientId }
// Reads the client's loved and disliked examples and returns what Claude learned, as short points.
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { MODELS } from '../../packages/core/src/models'
import { HOUSE_RULES } from '../../packages/core/src/voice'
import { assertUnderCap, claudeFor, jsonCall, logUsage } from './_shared/claude'
import { loadClient } from './_shared/client'
import { handle, HttpError, json } from './_shared/http'
import { requireUser } from './_shared/supabase'

const Body = z.object({ clientId: z.string().uuid() })

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const body = Body.safeParse(await req.json().catch(() => ({})))
  if (!body.success) throw new HttpError(400, 'Missing client')
  const ctx = await loadClient(workspaceId, body.data.clientId)
  if (!ctx.examples.some((e) => e.kind === 'loved')) throw new HttpError(400, 'Add at least one post they loved first')
  await assertUnderCap(workspaceId)

  const examples = ctx.examples
    .map((e) => `${e.kind === 'loved' ? 'LOVED' : 'DISLIKED'}${e.channel ? ` (${e.channel})` : ''}:\n${e.body}${e.reason ? `\nWhy they disliked it: ${e.reason}` : ''}`)
    .join('\n\n')
  const model = MODELS.haiku
  const { data, usage } = await jsonCall<{ points: string[] }>({
    claude: await claudeFor(workspaceId),
    model,
    brief: `You study writing samples for ${ctx.client.name} and describe their voice so other writers can copy it.\n\n${HOUSE_RULES}`,
    toolName: 'voice_points',
    instruction: `Here are posts the client loved and disliked:\n\n${examples}\n\nList 4 to 6 short, specific points about how this client writes (openings, sentence length, point of view, tone, what they avoid, how posts end). Each point under 12 words.`,
    schema: { type: 'object', properties: { points: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 } }, required: ['points'] },
    maxTokens: 400,
  })

  await logUsage({ workspaceId, clientId: ctx.client.id, purpose: 'voice', model, usage })
  return json(data)
})

export const config: Config = { path: '/api/learn-voice' }
