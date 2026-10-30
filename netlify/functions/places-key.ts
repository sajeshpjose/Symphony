// POST /api/places-key
//   { action: "save", apiKey }  -> stores the Google Places key in Vault, then tests it
//   { action: "test" }          -> tests the stored key
import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { testPlacesKey } from '../../src/research/places'
import { handle, HttpError, json } from './_shared/http'
import { adminClient, requireUser } from './_shared/supabase'

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save'), apiKey: z.string().trim().min(30).max(100) }),
  z.object({ action: z.literal('test') }),
])

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new HttpError(400, 'That does not look like a Google API key')
  const db = adminClient()
  if (parsed.data.action === 'save') {
    const { error } = await db.rpc('set_places_key', { ws: workspaceId, api_key: parsed.data.apiKey })
    if (error) throw error
  }
  const { data: key, error } = await db.rpc('get_places_key', { ws: workspaceId })
  if (error) throw error
  if (!key) throw new HttpError(400, 'No key saved yet')
  const result = await testPlacesKey(key as string)
  await db.from('workspaces').update({ places_key_ok: result.ok, places_key_tested_at: new Date().toISOString() }).eq('id', workspaceId)
  return json(result)
})

export const config: Config = { path: '/api/places-key' }
