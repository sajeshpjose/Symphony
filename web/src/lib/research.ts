import { useQuery } from '@tanstack/react-query'
import type { Question, ReportData, ResearchClaim } from '@symph/core'
import type { Tone } from '../components/ui'
import { supabase } from './supabase'

export type RunStatus = 'queued' | 'running' | 'needs_input' | 'ready' | 'failed'

export type RunRow = {
  id: string
  client_id: string
  status: RunStatus
  step: string | null
  progress: string | null
  website: string | null
  inputs: { competitors?: string[]; pasted_text?: string }
  report: ReportData | null
  claims: ResearchClaim[] | null
  questions: Question[] | null
  warnings: string[]
  stats: { pages?: number; competitor_pages?: number; claims?: number; included?: number; questions?: number; dropped?: number; sections?: number }
  error: string | null
  cost_usd: number | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  clients?: { name: string } | null
}

export type PageRow = { id: string; ref: string; url: string; title: string | null; kind: 'client' | 'competitor' | 'pasted' | 'upload'; competitor: string | null; words: number; text?: string }

export const isActive = (s: RunStatus) => s === 'queued' || s === 'running'

export const STATUS_CHIP: Record<RunStatus, [string, Tone]> = {
  queued: ['Waiting', 'accent'],
  running: ['Running', 'accent'],
  needs_input: ['Needs page text', 'warn'],
  ready: ['Ready', 'ok'],
  failed: ['Failed', 'bad'],
}

const LIST_COLS = 'id, client_id, status, step, progress, website, stats, error, cost_usd, started_at, finished_at, created_at, clients(name)'

export function useRuns(clientId?: string) {
  return useQuery({
    queryKey: ['research-runs', clientId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('research_runs').select(LIST_COLS).order('created_at', { ascending: false }).limit(100)
      if (clientId) q = q.eq('client_id', clientId)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as RunRow[]
    },
    // Keep the list fresh while anything is running.
    refetchInterval: (query) => ((query.state.data as RunRow[] | undefined)?.some((r) => isActive(r.status)) ? 4000 : false),
  })
}

export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: ['research-run', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('research_runs').select('*, clients(name)').eq('id', id!).single()
      if (error) throw error
      return data as unknown as RunRow
    },
    refetchInterval: (query) => {
      const r = query.state.data as RunRow | undefined
      return r && isActive(r.status) ? 3000 : false
    },
  })
}

export function usePages(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['research-pages', runId],
    enabled: !!runId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('research_pages').select('id, ref, url, title, kind, competitor, words').eq('run_id', runId!).order('ref')
      if (error) throw error
      return data as PageRow[]
    },
  })
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

export const fmtDuration = (a: string | null, b: string | null) => {
  if (!a || !b) return ''
  const m = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
  return m < 1 ? 'under a minute' : `${m} min`
}
