// POST /api/topics-suggest  { clientId }
// Suggests five blog topics from the client's profile and latest research and saves them to `topics`.
// Short call (Haiku by default), so it runs here and not on Trigger.dev. Press again for five more.
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { MODELS } from '../../packages/core/src/models'
import type { Question, ResearchClaim } from '../../packages/core/src/research'
import { blockingProblems, cleanTopics, TOPICS_SCHEMA, topicProblems, topicsInstruction, type SuggestedTopic } from '../../packages/core/src/topics'
import { voiceBrief } from '../../packages/core/src/voice'
import { assertUnderCap, claudeFor, jsonCall, logUsage } from './_shared/claude'
import { loadClient } from './_shared/client'
import { handle, HttpError, json } from './_shared/http'
import { adminClient, requireUser } from './_shared/supabase'

const Body = z.object({ clientId: z.string().uuid() })
const MAX_OPEN_TOPICS = 20

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const body = Body.safeParse(await req.json().catch(() => ({})))
  if (!body.success) throw new HttpError(400, 'Missing client')
  const ctx = await loadClient(workspaceId, body.data.clientId)
  const client = ctx.client as typeof ctx.client & { services?: { name: string }[] }
  if (!client.sells?.trim() || !client.audience?.trim()) throw new HttpError(400, 'Add what they sell and who they serve first (Business details)')
  if (!ctx.voice.summary?.trim()) throw new HttpError(400, 'Set up the voice first')
  await assertUnderCap(workspaceId)

  const db = adminClient()
  const [{ data: ws }, { data: run }, { data: existingRows }] = await Promise.all([
    db.from('workspaces').select('models').eq('id', workspaceId).single(),
    db.from('research_runs').select('id, claims, questions').eq('client_id', client.id).eq('status', 'ready').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('topics').select('title, status').eq('client_id', client.id).order('created_at', { ascending: false }).limit(60),
  ])
  const existing = (existingRows ?? []).map((t) => t.title as string)
  const open = (existingRows ?? []).filter((t) => t.status === 'suggested').length
  if (open >= MAX_OPEN_TOPICS) throw new HttpError(409, `There are already ${open} suggested topics. Write or remove some first.`)

  const claims = ((run?.claims ?? []) as ResearchClaim[]).filter((c) => c.status === 'included' && !c.competitor).map((c) => c.text)
  const questions = ((run?.questions ?? []) as Question[]).filter((q) => q.priority === 'must').map((q) => q.question)
  const services = (client.services ?? []).map((s) => s.name)
  const model = ((ws?.models as Record<string, string> | null)?.topics ?? MODELS.haiku) as string
  const claude = await claudeFor(workspaceId)
  const brief = voiceBrief(client, ctx.voice, [], ctx.facts)
  const context = { goal: client.goal, services, claims, questions, existing, today: new Date().toISOString().slice(0, 10) }

  // One pass, and one more if the first broke a rule (dashes, banned words, length, repeats).
  let topics: SuggestedTopic[] = []
  let feedback: string[] | undefined
  for (let pass = 0; pass < 2; pass++) {
    const { data, usage } = await jsonCall<{ topics: SuggestedTopic[] }>({
      claude,
      model,
      brief,
      toolName: 'topics',
      schema: TOPICS_SCHEMA,
      instruction: topicsInstruction(context, feedback),
      maxTokens: 1800,
    })
    await logUsage({ workspaceId, clientId: client.id, purpose: 'topics', model, usage })
    topics = data.topics ?? []
    feedback = topicProblems(topics, existing, ctx.voice.words_avoid)
    if (!feedback.length) break
  }

  const cleaned = cleanTopics(topics, services, existing)
  const rejected = cleaned.flatMap((t) => blockingProblems(t, ctx.voice.words_avoid))
  const clean = cleaned.filter((t) => blockingProblems(t, ctx.voice.words_avoid).length === 0)
  if (!clean.length) {
    console.error('topics-suggest: nothing usable', { returned: topics.length, cleaned: cleaned.length, rejected })
    const why = !topics.length ? 'Claude returned no topics' : !cleaned.length ? 'every topic repeated one already on the list' : `rules broken: ${rejected.slice(0, 3).join('; ')}`
    throw new HttpError(502, `No usable topics (${why}). Try again.`)
  }

  const { data: saved, error } = await db
    .from('topics')
    .insert(
      clean.map((t) => ({
        client_id: client.id,
        workspace_id: workspaceId,
        research_run_id: run?.id ?? null,
        title: t.title,
        who_asks: t.who_asks,
        gist: t.gist,
        service: t.service || null,
        why: t.signal,
        keyword_primary: t.keyword_primary,
        image_keywords: [t.keyword_primary, ...t.keyword_alternates].filter(Boolean),
      })),
    )
    .select('id')
  if (error) throw error
  return json({ added: saved?.length ?? 0 })
})

export const config: Config = { path: '/api/topics-suggest' }
