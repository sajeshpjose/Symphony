import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Card, Chip, Empty, Note, PageHeader, Select, Table } from '../components/ui'
import { fmtDate } from '../lib/research'
import { checkCounts, POST_STATUS, usePosts } from '../lib/posts'
import { supabase } from '../lib/supabase'

// Posts written by Claude, waiting for review.
export function Content() {
  const [params, setParams] = useSearchParams()
  const clientId = params.get('client') || undefined
  const clients = useQuery({
    queryKey: ['client-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })
  const { data, isLoading, error } = usePosts(clientId)
  return (
    <>
      <PageHeader
        title="Content"
        subtitle="Posts written by Claude. Read each one, fix anything the checks flag, then copy or download."
        actions={
          <Select value={clientId ?? ''} onChange={(e) => setParams(e.target.value ? { client: e.target.value } : {})} className="w-56">
            <option value="">All clients</option>
            {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        }
      />
      {error && <Note tone="bad">{(error as Error).message}</Note>}
      <Card flush className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-fg-3">Loading…</div>
        ) : !data?.length ? (
          <Empty title="No posts yet">Tick topics on the Topics page and press Write. Each post takes about a minute.</Empty>
        ) : (
          <Table head={['Post', 'Client', 'Status', 'Checks', 'Updated', '']}>
            {data.map((p) => {
              const [label, tone] = POST_STATUS[p.status]
              const n = checkCounts(p.checks ?? [])
              return (
                <tr key={p.id}>
                  <td className="max-w-md">
                    <div className="font-medium">{p.title ?? 'Untitled'}</div>
                    {p.status === 'failed' && p.error && <div className="mt-1 text-xs text-bad">{p.error}</div>}
                  </td>
                  <td>{p.clients?.name}</td>
                  <td><Chip tone={tone} dot={p.status === 'writing'}>{label}</Chip></td>
                  <td>
                    {p.status === 'writing' || p.status === 'failed' ? '—' : (
                      <span className="flex gap-1.5">
                        {n.fail > 0 && <Chip tone="bad">{n.fail} to fix</Chip>}
                        {n.warn > 0 && <Chip tone="warn">{n.warn} to check</Chip>}
                        {n.fail + n.warn === 0 && <Chip tone="ok">All passed</Chip>}
                      </span>
                    )}
                  </td>
                  <td>{fmtDate(p.updated_at)}</td>
                  <td className="text-right">
                    {p.status !== 'writing' && p.status !== 'failed' && <Link to={`/content/${p.id}`} className="font-medium underline-offset-4 hover:underline">Open</Link>}
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>
    </>
  )
}
