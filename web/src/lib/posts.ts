import { useQuery } from '@tanstack/react-query'
import type { Check, CoverText, ImageKeyword, PostStatus, Social } from '@symph/core'
import type { Tone } from '../components/ui'
import { supabase } from './supabase'

export type PostRow = {
  id: string
  client_id: string
  topic_id: string | null
  status: PostStatus
  title: string | null
  body_md: string | null
  body_html: string | null
  faq: { q: string; a: string }[] | null
  checks: Check[]
  social: Social
  image_keywords: ImageKeyword[]
  image_avoid: string | null
  cover: Partial<CoverText> | null
  error: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  clients?: { name: string } | null
}

export const POST_STATUS: Record<PostStatus, [string, Tone]> = {
  writing: ['Writing', 'accent'],
  to_review: ['To review', 'warn'],
  reviewed: ['Reviewed', 'ok'],
  failed: ['Failed', 'bad'],
}

const LIST_COLS = 'id, client_id, topic_id, status, title, checks, error, reviewed_at, created_at, updated_at, clients(name)'

export function usePosts(clientId?: string) {
  return useQuery({
    queryKey: ['posts', clientId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('posts').select(LIST_COLS).order('created_at', { ascending: false }).limit(100)
      if (clientId) q = q.eq('client_id', clientId)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as PostRow[]
    },
    // Keep the list fresh while posts are being written.
    refetchInterval: (query) => ((query.state.data as PostRow[] | undefined)?.some((p) => p.status === 'writing') ? 4000 : false),
  })
}

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: ['post', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('posts').select('*, clients(name)').eq('id', id!).single()
      if (error) throw error
      return data as unknown as PostRow
    },
    refetchInterval: (query) => ((query.state.data as PostRow | undefined)?.status === 'writing' ? 4000 : false),
  })
}

export const checkCounts = (checks: Check[]) => ({
  fail: checks.filter((c) => c.status === 'fail').length,
  warn: checks.filter((c) => c.status === 'warn').length,
})
