// Post batch (MVP step 5 to 8). For each ticked topic Claude writes the blog post, the social copy and
// five image search phrases in one call. The result is built into HTML and checked with the same rules as
// the content skill; if a check fails, Claude gets one pass to fix it. Posts then wait for review.
// Progress is saved on each post row, so the app shows it while the batch runs.
import { AbortTaskRunError, logger, metadata, schemaTask } from '@trigger.dev/sdk'
import { z } from 'zod'
import { claudeFor } from '../../netlify/functions/_shared/claude'
import { adminClient } from '../../netlify/functions/_shared/supabase'
import { trimCover } from '../../packages/core/src/cover'
import { blogClientFrom, checkPost, hasFailures, postInstruction, postSchema, problemsFrom, type PostResult, type PostTopic } from '../../packages/core/src/posts'
import { CHANNELS, type Channel } from '../../packages/core/src/types'
import { DEFAULT_VOICE, voiceBrief, type ClientInfo, type VoiceProfile } from '../../packages/core/src/voice'
import { toolCall, type CallCtx } from '../research/claude'

const PARALLEL = 3

const errorDetail = (e: unknown) => {
  const any = e as { message?: string; status?: number; error?: { error?: { message?: string } } }
  return [any?.status ? `HTTP ${any.status}` : '', any?.error?.error?.message ?? any?.message ?? 'unknown error'].filter(Boolean).join(' · ').slice(0, 500)
}

export const postBatch = schemaTask({
  id: 'post-batch',
  schema: z.object({ postIds: z.array(z.string().uuid()).min(1).max(10) }),
  maxDuration: 3600,
  // A failed post is marked failed in the app and can be written again; no automatic re-runs (they cost money).
  retry: { maxAttempts: 1 },
  queue: { concurrencyLimit: 2 },
  run: async ({ postIds }) => {
    const db = adminClient()
    const { data: posts } = await db.from('posts').select('id, topic_id, client_id, workspace_id').in('id', postIds)
    if (!posts?.length) throw new AbortTaskRunError('Posts not found')
    const { client_id: clientId, workspace_id: workspaceId } = posts[0]

    const [{ data: client }, { data: ws }, { data: voiceRow }, { data: examples }, { data: facts }, { data: topics }] = await Promise.all([
      db.from('clients').select('*').eq('id', clientId).single(),
      db.from('workspaces').select('models').eq('id', workspaceId).single(),
      db.from('voice_profiles').select('*').eq('client_id', clientId).maybeSingle(),
      db.from('examples').select('kind, channel, title, body, reason').eq('client_id', clientId),
      db.from('facts').select('text, type, status').eq('client_id', clientId),
      db.from('topics').select('id, title, gist, who_asks, service, why').in('id', posts.map((p) => p.topic_id).filter(Boolean)),
    ])
    if (!client) throw new AbortTaskRunError('Client not found')
    const voice = { ...DEFAULT_VOICE, ...(voiceRow ?? {}) } as VoiceProfile
    const channels = ((client.social_channels as string[]) ?? []).filter((c): c is Channel => (CHANNELS as string[]).includes(c))
    const model: string = (ws?.models as Record<string, string> | null)?.post ?? 'claude-sonnet-5-5'
    const claude = await claudeFor(workspaceId)
    const brief = voiceBrief(client as ClientInfo, voice, examples ?? [], facts ?? [])
    const blogClient = blogClientFrom(client, voice.spelling)
    const today = new Date().toISOString().slice(0, 10)
    const topicById = new Map((topics ?? []).map((t) => [t.id as string, t as PostTopic & { id: string }]))
    const schema = postSchema(channels)
    let cost = 0
    const call: CallCtx = { claude, model, workspaceId, clientId, system: brief, purpose: 'post', onCost: (c) => (cost += c) }
    let done = 0
    metadata.set('total', posts.length).set('done', 0)

    const writeOne = async (post: { id: string; topic_id: string | null }) => {
      const topic = post.topic_id ? topicById.get(post.topic_id) : undefined
      try {
        if (!topic) throw new Error('Topic not found')
        const ctx = { topic, today, channels, voice, client: blogClient }
        const check = (r: PostResult) => checkPost(r, { client: blogClient, avoid: voice.words_avoid, channels })
        let result = await toolCall<PostResult>(call, { content: postInstruction(ctx), toolName: 'post', schema, maxTokens: 6000 })
        let checked = check(result)
        if (hasFailures(checked.checks)) {
          // One fix pass, listing what failed. Warnings stay for the reviewer.
          result = await toolCall<PostResult>(call, {
            content: postInstruction(ctx, { previous: result, problems: problemsFrom(checked.checks, ['fail']) }),
            toolName: 'post',
            schema,
            maxTokens: 6000,
          })
          checked = check(result)
        }
        const { error } = await db
          .from('posts')
          .update({
            status: 'to_review',
            title: checked.title || topic.title,
            body_md: checked.body_md,
            body_html: checked.body_html,
            faq: checked.faq,
            checks: checked.checks,
            social: result.social,
            image_keywords: result.image_keywords,
            image_avoid: result.image_avoid ?? null,
            cover: trimCover(result.cover),
            error: null,
          })
          .eq('id', post.id)
        if (error) throw error
        await db.from('topics').update({ status: 'written' }).eq('id', topic.id)
      } catch (e) {
        const message = errorDetail(e)
        logger.error('Post failed', { postId: post.id, message })
        await db.from('posts').update({ status: 'failed', error: message }).eq('id', post.id)
        // Back to the list so the topic can be written again.
        if (post.topic_id) await db.from('topics').update({ status: 'suggested' }).eq('id', post.topic_id)
      } finally {
        metadata.set('done', ++done)
      }
    }

    // Parallel calls only (no wait.* here), a few at a time.
    for (let i = 0; i < posts.length; i += PARALLEL) await Promise.all(posts.slice(i, i + PARALLEL).map(writeOne))
    return { posts: posts.length, cost_usd: Number(cost.toFixed(4)) }
  },
})
