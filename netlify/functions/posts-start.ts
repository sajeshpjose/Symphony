// POST /api/posts-start  { clientId, topicIds }
// Creates a post row for each ticked topic and hands the batch to the Trigger.dev "post-batch" task.
import type { Config } from '@netlify/functions'
import { tasks } from '@trigger.dev/sdk'
import { z } from 'zod'
import type { postBatch } from '../../src/trigger/post-batch'
import { assertUnderCap, claudeFor } from './_shared/claude'
import { loadClient } from './_shared/client'
import { handle, HttpError, json } from './_shared/http'
import { adminClient, requireUser } from './_shared/supabase'

const Body = z.object({ clientId: z.string().uuid(), topicIds: z.array(z.string().uuid()).min(1).max(10) })

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new HttpError(400, 'Pick between 1 and 10 topics')
  const { clientId, topicIds } = parsed.data
  const ctx = await loadClient(workspaceId, clientId)
  const client = ctx.client as typeof ctx.client & { author_name?: string | null }
  const missing = [
    !client.sells?.trim() && 'what they sell',
    !client.audience?.trim() && 'who they serve',
    !client.author_name?.trim() && 'the author',
    !ctx.voice.summary?.trim() && 'the voice',
  ].filter(Boolean)
  if (missing.length) throw new HttpError(400, `Add ${missing.join(', ')} first (content profile)`)

  await claudeFor(workspaceId) // fails early if no key is saved
  await assertUnderCap(workspaceId)
  if (!process.env.TRIGGER_SECRET_KEY) throw new HttpError(500, 'Server is missing TRIGGER_SECRET_KEY')

  const db = adminClient()
  const { data: topics } = await db.from('topics').select('id, title').eq('client_id', clientId).eq('status', 'suggested').in('id', topicIds)
  if (!topics?.length) throw new HttpError(409, 'Those topics are already being written')

  const { data: posts, error } = await db
    .from('posts')
    .insert(topics.map((t) => ({ topic_id: t.id, client_id: clientId, workspace_id: workspaceId, title: t.title, status: 'writing' })))
    .select('id')
  if (error) throw error
  const postIds = (posts ?? []).map((p) => p.id as string)
  await db.from('topics').update({ status: 'writing' }).in('id', topics.map((t) => t.id))

  try {
    await tasks.trigger<typeof postBatch>('post-batch', { postIds }, { tags: [`client:${clientId}`] })
  } catch (e) {
    console.error(e)
    await db.from('posts').update({ status: 'failed', error: 'Could not start the background job. Is the Trigger.dev worker running?' }).in('id', postIds)
    await db.from('topics').update({ status: 'suggested' }).in('id', topics.map((t) => t.id))
    throw new HttpError(502, 'Could not start writing. Check that Trigger.dev is running.')
  }
  return json({ started: postIds.length })
})

export const config: Config = { path: '/api/posts-start' }
