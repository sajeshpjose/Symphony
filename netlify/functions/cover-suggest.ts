// POST /api/cover-suggest  { postId }
// Writes the three cover lines (eyebrow, heading, description) for a post that has none, or writes them again.
// New posts get cover text from the post batch; this covers older posts and "write again".
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { checkCover, COVER_RULES, COVER_SCHEMA, trimCover, type CoverText } from '../../packages/core/src/cover'
import { parseBlog, stripMd } from '../../packages/core/src/blog'
import { MODELS } from '../../packages/core/src/models'
import type { Check } from '../../packages/core/src/types'
import { voiceBrief } from '../../packages/core/src/voice'
import { assertUnderCap, claudeFor, jsonCall, logUsage } from './_shared/claude'
import { loadClient } from './_shared/client'
import { handle, HttpError, json } from './_shared/http'
import { adminClient, requireUser } from './_shared/supabase'

const Body = z.object({ postId: z.string().uuid() })

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const body = Body.safeParse(await req.json().catch(() => ({})))
  if (!body.success) throw new HttpError(400, 'Missing post')
  const db = adminClient()
  const { data: post } = await db.from('posts').select('id, client_id, title, body_md, checks').eq('id', body.data.postId).eq('workspace_id', workspaceId).maybeSingle()
  if (!post?.body_md) throw new HttpError(404, 'Post not found')
  const ctx = await loadClient(workspaceId, post.client_id)
  await assertUnderCap(workspaceId)

  const { fm, body: md } = parseBlog(post.body_md)
  const short = stripMd(md.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith('#')) ?? '')
  const { data: ws } = await db.from('workspaces').select('models').eq('id', workspaceId).single()
  const model = ((ws?.models as Record<string, string> | null)?.social ?? MODELS.haiku) as string
  const claude = await claudeFor(workspaceId)
  const brief = voiceBrief(ctx.client, ctx.voice, [], ctx.facts)

  let cover: CoverText = { eyebrow: '', heading: '', description: '' }
  let check: Check = checkCover(null)
  let feedback = ''
  for (let pass = 0; pass < 2; pass++) {
    const { data, usage } = await jsonCall<{ cover: CoverText }>({
      claude,
      model,
      brief,
      toolName: 'cover',
      schema: { type: 'object', properties: { cover: COVER_SCHEMA }, required: ['cover'] },
      instruction: `Write the cover text for the image that goes with this blog post.\n\nPost title: ${fm.title ?? post.title}\nShort answer: ${short}\n\n${COVER_RULES}${feedback}`,
      maxTokens: 400,
    })
    await logUsage({ workspaceId, clientId: post.client_id, purpose: 'social', model, usage })
    cover = trimCover(data.cover)
    check = checkCover(cover, { avoid: ctx.voice.words_avoid })
    if (check.status !== 'fail') break
    feedback = `\n\nYour last answer broke these rules. Fix them: ${check.note}`
  }

  const checks = [...((post.checks ?? []) as Check[]).filter((c) => c.id !== 'cover'), check]
  const { error } = await db.from('posts').update({ cover, checks }).eq('id', post.id)
  if (error) throw error
  return json({ cover })
})

export const config: Config = { path: '/api/cover-suggest' }
