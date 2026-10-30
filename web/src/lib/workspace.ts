import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Workspace = {
  id: string
  name: string
  anthropic_key_hint: string | null
  anthropic_key_ok: boolean | null
  anthropic_key_tested_at: string | null
  places_key_hint: string | null
  places_key_ok: boolean | null
  places_key_tested_at: string | null
  models: Record<string, string>
  use_batch: Record<string, boolean>
  monthly_cap_usd: number
  alert_thresholds: number[]
  stop_at_cap: boolean
}

// The signed-in user's workspace (one per user for now).
export function useWorkspace() {
  return useQuery({
    queryKey: ['workspace'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('*').limit(1).single()
      if (error) throw error
      return data as Workspace
    },
  })
}
