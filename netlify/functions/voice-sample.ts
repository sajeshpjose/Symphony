// POST /api/voice-sample  { clientId, voice? }
// Writes a short LinkedIn post in the client's voice plus a plain summary of how Claude reads the voice.
// `voice` carries unsaved changes from the Voice and tone step so the sample matches what is on screen.
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { MODELS } from '../../packages/core/src/models'
import { voiceBrief, type VoiceProfile } from '../../packages/core/src/voice'
import { assertUnderCap, claudeFor, jsonCall, logUsage } from './_shared/claude'
import { loadClient } from './_shared/client'
import { handle, HttpError, json } from './_shared/http'
import { requireUser } from './_shared/supabase'

const Body = z.object({ clientId: z.string().uuid(), voice: z.record(z.string(), z.unknown()).optional(), topic: z.string().max(200).optional() })

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const body = Body.safeParse(await req.json().catch(() => ({})))
  if (!body.success) throw new HttpError(400, 'Missing client')
  await assertUnderCap(workspaceId)

  const ctx = await loadClient(workspaceId, body.data.clientId)
  const voice = { ...ctx.voice, ...(body.data.voice ?? {}) } as VoiceProfile
  // Leave the old summary out so the new one reflects the current settings.
  const brief = voiceBrief(ctx.client, { ...voice, summary: null }, ctx.examples, ctx.facts)
  const model = MODELS.haiku

  const { data, usage } = await jsonCall<{ sample: string; summary: string }>({
    claude: await claudeFor(workspaceId),
    model,
    brief,
    toolName: 'voice_sample',
    instruction: `Write one LinkedIn post (40 to 70 words) in this client's voice${
      body.data.topic ? ` about: ${body.data.topic}` : ' about a timely, practical tip for their customers'
    }. Then describe the voice in 2 or 3 short sentences, starting with the traits, so the client can confirm it sounds like them.`,
    schema: {
      type: 'object',
      properties: {
        sample: { type: 'string', description: 'The LinkedIn post text' },
        summary: { type: 'string', description: 'How Claude will read this voice, 2 or 3 sentences' },
      },
      required: ['sample', 'summary'],
    },
    maxTokens: 600,
  })

  await logUsage({ workspaceId, clientId: ctx.client.id, purpose: 'voice', model, usage })
  return json(data)
})

export const config: Config = { path: '/api/voice-sample' }
