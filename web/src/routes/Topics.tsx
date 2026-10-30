import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Card, Chip, Empty, Note, PageHeader, Select, cx } from '../components/ui'
import { useClientBundle } from '../lib/client'
import { contentReady, missingForContent, profileItems } from '../lib/profile'
import { supabase } from '../lib/supabase'
import { useTopicActions, useTopics, type TopicRow } from '../lib/topics'

const STATUS: Record<TopicRow['status'], [string, 'neutral' | 'accent' | 'ok']> = {
  suggested: ['Suggested', 'neutral'],
  writing: ['Writing', 'accent'],
  written: ['Written', 'ok'],
  dropped: ['Removed', 'neutral'],
}

const photoLinks = (kw: string) => [
  ['Unsplash', `https://unsplash.com/s/photos/${encodeURIComponent(kw)}`],
  ['Pexels', `https://www.pexels.com/search/${encodeURIComponent(kw)}/`],
]

// Next 5 topics for a client. No client approval in the MVP: untick any, ask for 5 more.
export function Topics() {
  const [params, setParams] = useSearchParams()
  const clients = useQuery({
    queryKey: ['client-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name').order('name')
      if (error) throw error
      return data as { id: string; name: string }[]
    },
  })
  const clientId = params.get('client') ?? clients.data?.[0]?.id
  const bundle = useClientBundle(clientId)
  const topics = useTopics(clientId)
  const { patch, suggest, write } = useTopicActions(clientId)
  const nav = useNavigate()

  const items = bundle.data ? profileItems(bundle.data) : []
  const missing = missingForContent(items)
  const ready = bundle.data ? contentReady(items) : false
  const rows = topics.data ?? []
  const chosenIds = rows.filter((t) => t.selected && t.status === 'suggested').map((t) => t.id)
  const chosen = chosenIds.length

  return (
    <>
      <PageHeader
        title="Topics"
        subtitle="Five questions this client's customers ask before buying. Untick any you do not want."
        actions={
          <>
            {clients.data && clients.data.length > 0 && (
              <Select value={clientId ?? ''} onChange={(e) => setParams({ client: e.target.value })} className="w-56">
                {clients.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
            <Button variant="primary" loading={suggest.isPending} disabled={!ready} onClick={() => suggest.mutate()} title={ready ? '' : 'Finish the content profile first'}>
              <Sparkles className="size-4" /> {rows.length ? 'Ask for 5 more' : 'Suggest 5 topics'}
            </Button>
          </>
        }
      />
      {suggest.error && <div className="mb-4"><Note tone="bad">{(suggest.error as Error).message}</Note></div>}
      {write.error && <div className="mb-4"><Note tone="bad">{(write.error as Error).message}</Note></div>}
      {suggest.data && <div className="mb-4"><Note tone="ok">Added {suggest.data.added} topics.</Note></div>}
      {bundle.data && !ready && (
        <div className="mb-4">
          <Note tone="warn" title="Finish the content profile first">
            Still needed: {missing.map((i) => i.label.toLowerCase()).join(' and ')}. <Link className="underline" to={`/clients/${clientId}`}>Open {bundle.data.client.name}</Link>
          </Note>
        </div>
      )}
      <Card flush>
        {clients.isLoading || topics.isLoading ? (
          <div className="p-10 text-center text-fg-3">Loading…</div>
        ) : !clients.data?.length ? (
          <Empty title="No clients yet" action={<Link to="/clients/new"><Button variant="primary">Add client</Button></Link>}>Add a client, then come back for topics.</Empty>
        ) : !rows.length ? (
          <Empty title="No topics yet">
            {ready ? 'Claude reads the research and the profile, then suggests five questions worth a post.' : 'Finish the content profile, then ask for topics.'}
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => {
              const locked = t.status !== 'suggested'
              const [label, tone] = STATUS[t.status]
              return (
                <li key={t.id} className={cx('flex gap-4 px-5 py-4', locked && 'bg-subtle/50')}>
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--color-ink)]"
                    checked={t.selected}
                    disabled={locked}
                    onChange={(e) => patch.mutate({ id: t.id, selected: e.target.checked })}
                    aria-label={`Write ${t.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <h3 className="flex-1 font-serif text-lg leading-snug">{t.title}</h3>
                      <Chip tone={tone}>{label}</Chip>
                    </div>
                    {t.gist && <p className="mt-1 text-sm text-fg-2">{t.gist}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-3">
                      {t.who_asks && <span>Asked by {t.who_asks.toLowerCase()}</span>}
                      {t.service && <span>Service: {t.service}</span>}
                      {t.why && <span>{t.why}</span>}
                    </div>
                    {t.image_keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-fg-3">Photo search:</span>
                        {t.image_keywords.slice(0, 1).map((kw) => (
                          <span key={kw} className="flex items-center gap-1.5">
                            <Chip>{kw}</Chip>
                            {photoLinks(kw).map(([name, href]) => <a key={name} href={href} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{name}</a>)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!locked && (
                    <button type="button" className="self-start text-xs text-fg-3 hover:text-fg" onClick={() => patch.mutate({ id: t.id, status: 'dropped' })}>Remove</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {rows.length > 0 && (
          <footer className="flex items-center gap-3 border-t border-line px-5 py-3">
            <span className="flex-1 text-sm text-fg-2">{chosen} of {rows.filter((t) => t.status === 'suggested').length} ticked</span>
            <Button
              variant="primary"
              loading={write.isPending}
              disabled={!ready || chosen === 0 || chosen > 10}
              title={!ready ? 'Finish the content profile first' : chosen > 10 ? 'Write up to 10 at a time' : ''}
              onClick={() => write.mutate(chosenIds, { onSuccess: () => nav(`/content?client=${clientId}`) })}
            >
              Write {chosen} {chosen === 1 ? 'post' : 'posts'}
            </Button>
          </footer>
        )}
      </Card>
    </>
  )
}
