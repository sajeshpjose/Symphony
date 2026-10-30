import type { ClientInfo, Fact, VoiceExample, VoiceProfile } from '../../../packages/core/src/voice'
import { DEFAULT_VOICE } from '../../../packages/core/src/voice'
import { HttpError } from './http'
import { adminClient } from './supabase'

// Loads everything Claude needs to write for a client, checking it belongs to the caller's workspace.
export async function loadClient(workspaceId: string, clientId: string) {
  const db = adminClient()
  const { data: client } = await db.from('clients').select('*').eq('id', clientId).eq('workspace_id', workspaceId).maybeSingle()
  if (!client) throw new HttpError(404, 'Client not found')
  const [{ data: voice }, { data: examples }, { data: facts }] = await Promise.all([
    db.from('voice_profiles').select('*').eq('client_id', clientId).maybeSingle(),
    db.from('examples').select('kind, channel, title, body, reason').eq('client_id', clientId),
    db.from('facts').select('text, type, status').eq('client_id', clientId),
  ])
  return {
    client: client as ClientInfo & { id: string; social_channels: string[] },
    voice: { ...DEFAULT_VOICE, ...(voice ?? {}) } as VoiceProfile,
    examples: (examples ?? []) as VoiceExample[],
    facts: (facts ?? []) as Fact[],
  }
}
