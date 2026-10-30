import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TopicStatus } from '@symph/core'
import { api } from './api'
import { supabase } from './supabase'

export type TopicRow = {
  id: string
  client_id: string
  title: string
  why: string | null
  who_asks: string | null
  gist: string | null
  service: string | null
  image_keywords: string[]
  selected: boolean
  status: TopicStatus
  created_at: string
}

const COLS = 'id, client_id, title, why, who_asks, gist, service, image_keywords, selected, status, created_at'

// Topics for one client, newest first. Dropped topics are hidden.
export function useTopics(clientId: string | undefined) {
  return useQuery({
    queryKey: ['topics', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('topics').select(COLS).eq('client_id', clientId!).neq('status', 'dropped').order('created_at', { ascending: false })
      if (error) throw error
      return data as TopicRow[]
    },
  })
}

export function useTopicActions(clientId: string | undefined) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['topics', clientId] })
  const patch = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; selected?: boolean; status?: TopicStatus }) => {
      const { error } = await supabase.from('topics').update(fields).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const suggest = useMutation({
    mutationFn: () => api<{ added: number }>('topics-suggest', { clientId }),
    onSuccess: refresh,
  })
  const write = useMutation({
    mutationFn: (topicIds: string[]) => api<{ started: number }>('posts-start', { clientId, topicIds }),
    onSuccess: () => {
      refresh()
      qc.invalidateQueries({ queryKey: ['posts'] })
    },
  })
  return { patch, suggest, write }
}
