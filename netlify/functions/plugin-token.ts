// POST /api/plugin-token  { action: "create" | "revoke" }
// The Figma plugin signs in with a token instead of a password. The token is shown once; only its hash is stored.
import { createHash, randomBytes } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { handle, HttpError, json } from './_shared/http'
import { adminClient, requireUser } from './_shared/supabase'

const Body = z.object({ action: z.enum(['create', 'revoke']) })

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const body = Body.safeParse(await req.json().catch(() => ({})))
  if (!body.success) throw new HttpError(400, 'Use create or revoke')
  const db = adminClient()
  const token = body.data.action === 'create' ? `sym_${randomBytes(24).toString('base64url')}` : null
  const hash = token ? createHash('sha256').update(token).digest('hex') : null
  const { error } = await db.from('workspace_secrets').upsert({ workspace_id: workspaceId, plugin_token_hash: hash }, { onConflict: 'workspace_id' })
  if (error) throw error
  const { error: wErr } = await db
    .from('workspaces')
    .update({ plugin_token_hint: token ? token.slice(-4) : null, plugin_token_created_at: token ? new Date().toISOString() : null })
    .eq('id', workspaceId)
  if (wErr) throw wErr
  return json({ token })
})

export const config: Config = { path: '/api/plugin-token' }
