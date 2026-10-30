// GET /api/plugin-api                  -> { workspace, clients }
// GET /api/plugin-api?clientId=<uuid>  -> { client, posts } (posts with cover text, ready or in review)
// Read-only API for the Figma plugin. Signs in with the workspace plugin token (Settings), not a session.
// Figma plugin pages have no origin, so every response allows any origin; the token is the protection.
import { createHash } from 'node:crypto'
import type { Config } from '@netlify/functions'
import { handle, HttpError, json } from './_shared/http'
import { adminClient } from './_shared/supabase'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, OPTIONS',
}

const inner = handle(async (req) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Use GET')
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token?.startsWith('sym_')) throw new HttpError(401, 'Paste the Symph plugin token (Settings, Figma plugin)')
  const db = adminClient()
  const hash = createHash('sha256').update(token).digest('hex')
  const { data: secret } = await db.from('workspace_secrets').select('workspace_id').eq('plugin_token_hash', hash).maybeSingle()
  if (!secret) throw new HttpError(401, 'That token is not valid. Create a new one in Settings.')
  const workspaceId = secret.workspace_id as string

  const clientId = new URL(req.url).searchParams.get('clientId')
  if (!clientId) {
    const [{ data: ws }, { data: clients }] = await Promise.all([
      db.from('workspaces').select('name').eq('id', workspaceId).single(),
      db.from('clients').select('id, name, figma_url, social_channels').eq('workspace_id', workspaceId).order('name'),
    ])
    return json({ workspace: ws?.name ?? '', clients: clients ?? [] })
  }
  const { data: client } = await db.from('clients').select('id, name, figma_url, social_channels').eq('id', clientId).eq('workspace_id', workspaceId).maybeSingle()
  if (!client) throw new HttpError(404, 'Client not found')
  const { data: posts } = await db
    .from('posts')
    .select('id, title, status, cover, social, created_at, reviewed_at')
    .eq('client_id', clientId)
    .in('status', ['to_review', 'reviewed'])
    .order('created_at', { ascending: false })
    .limit(50)
  const withCover = (posts ?? []).filter((p) => (p.cover as { heading?: string } | null)?.heading)
  return json({ client, posts: withCover })
})

export default async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const res = await inner(req)
  Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v))
  return res
}

export const config: Config = { path: '/api/plugin-api' }
