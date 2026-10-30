// POST /api/suggest-business  { clientId }
// Suggests business details (industry, area, what they sell, who they serve) from the facts in the
// client's latest ready research run. Uses only facts that passed the checks; nothing is saved here,
// the form shows the suggestions for review.
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { MODELS } from '../../packages/core/src/models'
import type { ResearchClaim } from '../../packages/core/src/research'
import { HOUSE_RULES } from '../../packages/core/src/voice'
import { assertUnderCap, claudeFor, jsonCall, logUsage } from './_shared/claude'
import { handle, HttpError, json } from './_shared/http'
import { adminClient, requireUser } from './_shared/supabase'

const Body = z.object({ clientId: z.string().uuid() })

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const body = Body.safeParse(await req.json().catch(() => ({})))
  if (!body.success) throw new HttpError(400, 'Missing client')
  const db = adminClient()
  const { data: client } = await db.from('clients').select('id, name').eq('id', body.data.clientId).eq('workspace_id', workspaceId).maybeSingle()
  if (!client) throw new HttpError(404, 'Client not found')
  const { data: run } = await db
    .from('research_runs')
    .select('claims, finished_at')
    .eq('client_id', client.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!run) throw new HttpError(400, 'Run research first')
  const facts = ((run.claims ?? []) as ResearchClaim[]).filter((c) => c.status === 'included' && !c.competitor && c.evidence !== 'observed_absence')
  if (!facts.length) throw new HttpError(400, 'The latest research found no facts to use')
  await assertUnderCap(workspaceId)

  const model = MODELS.haiku
  const { data, usage } = await jsonCall<{ industry: string; location: string; sells: string; audience: string }>({
    claude: await claudeFor(workspaceId),
    model,
    brief: `You fill in a short client profile for a marketing agency from verified facts about ${client.name}. Use only what the facts say; leave a field empty when the facts do not cover it.\n\n${HOUSE_RULES}`,
    toolName: 'business_details',
    instruction: `Facts from ${client.name}'s website:\n${facts.map((c) => `- ${c.text}`).join('\n')}\n\nWrite:\n- industry: a few words\n- location: the area they serve, as the facts state it\n- sells: their main services or products, one or two sentences\n- audience: who they serve, one or two sentences\nEmpty string for anything the facts do not cover.`,
    schema: {
      type: 'object',
      properties: { industry: { type: 'string' }, location: { type: 'string' }, sells: { type: 'string' }, audience: { type: 'string' } },
      required: ['industry', 'location', 'sells', 'audience'],
    },
    maxTokens: 800,
  })
  await logUsage({ workspaceId, clientId: client.id, purpose: 'research', model, usage })
  return json({ ...data, run_date: run.finished_at })
})

export const config: Config = { path: '/api/suggest-business' }
