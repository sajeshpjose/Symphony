import { useQuery } from '@tanstack/react-query'
import type { Fact, VoiceExample, VoiceProfile } from '@symph/core'
import { supabase } from './supabase'

export type ClientRow = {
  id: string
  workspace_id: string
  name: string
  website: string | null
  industry: string | null
  location: string | null
  sells: string | null
  audience: string | null
  goal: string | null
  success_measure: string | null
  social_channels: string[]
  author_name: string | null
  author_role: string | null
  cta_text: string | null
  cta_url: string | null
  services: { name: string; url?: string }[]
  figma_url: string | null
  status: 'setup' | 'active' | 'paused'
  setup_step: number
}

export type VoiceRow = VoiceProfile & { client_id: string; workspace_id: string; task_instructions: Record<string, string> }
export type ExampleRow = VoiceExample & { id: string }
export type FactRow = Fact & { id: string; source: string | null }

// Everything the set-up steps and client page need, in one query.
export function useClientBundle(id: string | undefined) {
  return useQuery({
    queryKey: ['client', id],
    enabled: !!id,
    queryFn: async () => {
      const [c, v, e, f] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id!).single(),
        supabase.from('voice_profiles').select('*').eq('client_id', id!).maybeSingle(),
        supabase.from('examples').select('*').eq('client_id', id!).order('created_at'),
        supabase.from('facts').select('*').eq('client_id', id!).order('created_at'),
      ])
      if (c.error) throw c.error
      return {
        client: c.data as ClientRow,
        voice: v.data as VoiceRow | null,
        examples: (e.data ?? []) as ExampleRow[],
        facts: (f.data ?? []) as FactRow[],
      }
    },
  })
}
