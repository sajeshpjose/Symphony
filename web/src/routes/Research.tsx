import { Link } from 'react-router'
import { Button, Card, Chip, Empty, Note, PageHeader, Table } from '../components/ui'
import { fmtDate, STATUS_CHIP, useRuns } from '../lib/research'

// M3.1 Research runs
export function Research() {
  const { data, isLoading, error } = useRuns()
  return (
    <>
      <PageHeader
        title="Research"
        subtitle="Claude reads the client's site, checks competitors and writes a report you can defend."
        actions={<Link to="/research/new"><Button variant="primary">New research run</Button></Link>}
      />
      {error && <Note tone="bad">{(error as Error).message}</Note>}
      <Card flush className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-fg-3">Loading…</div>
        ) : !data?.length ? (
          <Empty title="No research yet" action={<Link to="/research/new"><Button variant="primary">Run research</Button></Link>}>
            Pick a client, add any exports you have, and Claude does the rest. A run takes a few minutes.
          </Empty>
        ) : (
          <Table head={['Client', 'Started', 'Status', 'Pages', 'In report', 'Questions', 'Cost', '']}>
            {data.map((r) => {
              const [label, tone] = STATUS_CHIP[r.status]
              return (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium">{r.clients?.name}</div>
                    {r.website && <div className="text-xs text-fg-3">{r.website}</div>}
                  </td>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>
                    <Chip tone={tone} dot={r.status === 'running'}>{label}</Chip>
                    {r.status === 'running' && r.progress && <div className="mt-1 text-xs text-fg-3">{r.progress}</div>}
                  </td>
                  <td>{r.stats?.pages ?? '—'}</td>
                  <td>{r.stats?.included !== undefined ? `${r.stats.included} facts` : '—'}</td>
                  <td>{r.stats?.questions ?? '—'}</td>
                  <td>{r.cost_usd !== null ? `$${Number(r.cost_usd).toFixed(2)}` : '—'}</td>
                  <td className="text-right">
                    <Link to={`/research/${r.id}`} className="font-medium underline-offset-4 hover:underline">Open</Link>
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
