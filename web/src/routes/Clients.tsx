import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button, Card, Chip, Empty, Note, PageHeader, Table, type Tone } from '../components/ui'
import { contentReady, profileItems } from '../lib/profile'
import { supabase } from '../lib/supabase'

type Row = {
  id: string
  name: string
  website: string | null
  status: string
  sells: string | null
  audience: string | null
  author_name: string | null
  voice_profiles: { summary: string | null; words_use: string[]; words_avoid: string[]; claims_never: string[]; disclaimer: string | null } | null
  facts: { status: 'approved' | 'needs_proof' | 'consent_needed' }[]
  examples: { kind: 'loved' | 'disliked' }[]
  research_runs: { status: string; created_at: string }[]
  topics: { status: string }[]
  posts: { status: string }[]
}

const researchChip = (runs: Row['research_runs']): [string, Tone] => {
  const last = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (!last) return ['Not run', 'neutral']
  if (last.status === 'ready') return [`Ready · ${new Date(last.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`, 'ok']
  if (last.status === 'failed') return ['Failed', 'bad']
  if (last.status === 'needs_input') return ['Needs page text', 'warn']
  return ['Running', 'accent']
}

export function Clients() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, website, status, sells, audience, author_name, voice_profiles(summary, words_use, words_avoid, claims_never, disclaimer), facts(status), examples(kind), research_runs(status, created_at), topics(status), posts(status)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as Row[]
    },
  })

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={data ? `${data.length} client${data.length === 1 ? '' : 's'}` : undefined}
        actions={
          <Link to="/clients/new">
            <Button variant="primary">Add client</Button>
          </Link>
        }
      />
      {error && <Note tone="bad">{(error as Error).message}</Note>}
      <Card flush className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-fg-3">Loading…</div>
        ) : !data?.length ? (
          <Empty title="No clients yet" action={<Link to="/clients/new"><Button variant="primary">Add your first client</Button></Link>}>
            Add a client with a name and website, run research, then fill in their voice before writing content.
          </Empty>
        ) : (
          <Table head={['Client', 'Research', 'Profile', 'Topics', 'Posts', '']}>
            {data.map((c) => {
              const [rLabel, rTone] = researchChip(c.research_runs)
              const items = profileItems({ client: c, voice: c.voice_profiles, facts: c.facts, examples: c.examples })
              const suggested = c.topics.filter((t) => t.status === 'suggested').length
              const toReview = c.posts.filter((p) => p.status === 'to_review').length
              const reviewed = c.posts.filter((p) => p.status === 'reviewed').length
              return (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium">{c.name}</div>
                    {c.website && <div className="text-xs text-fg-3">{c.website}</div>}
                  </td>
                  <td><Chip tone={rTone}>{rLabel}</Chip></td>
                  <td>{contentReady(items) ? <Chip tone="ok">Ready for content</Chip> : <Chip>{items.filter((i) => i.done).length} of {items.length}</Chip>}</td>
                  <td>{suggested ? `${suggested} suggested` : '—'}</td>
                  <td>{toReview ? `${toReview} to review` : reviewed ? `${reviewed} reviewed` : '—'}</td>
                  <td className="text-right">
                    <Link to={`/clients/${c.id}`} className="font-medium text-ink underline-offset-4 hover:underline">Open</Link>
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>
      <div className="mt-6">
        <Note title="How the MVP works">Set up the voice, run research, then ask for the next 5 topics. Nothing is sent to the client.</Note>
      </div>
    </>
  )
}
