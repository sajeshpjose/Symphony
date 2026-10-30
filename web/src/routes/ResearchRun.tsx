import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUESTION_TOPICS, type Block, type Question, type ResearchClaim, type Section } from '@symph/core'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button, Card, Chip, cx, Empty, Note, PageHeader, Segmented, Table, Toggle, type Tone } from '../components/ui'
import { supabase } from '../lib/supabase'
import { fmtDate, fmtDuration, STATUS_CHIP, usePages, useRun, type RunRow } from '../lib/research'

const STEPS = [
  { key: 'crawl', label: 'Read the website' },
  { key: 'claims', label: 'Pull out facts' },
  { key: 'competitors', label: 'Find and read competitors' },
  { key: 'reviews', label: 'Google ratings' },
  { key: 'verify', label: 'Check every quote' },
  { key: 'write', label: 'Write the report and questions' },
]

type Tab = 'report' | 'claims' | 'questions' | 'pages'

// M3.2 Research report
export function ResearchRun() {
  const { id } = useParams()
  const { data: run, error } = useRun(id)
  const [tab, setTab] = useState<Tab>('report')
  if (error) return <Note tone="bad">{(error as Error).message}</Note>
  if (!run) return null
  const [label, tone] = STATUS_CHIP[run.status]
  const clientName = run.clients?.name ?? 'Client'

  return (
    <>
      <PageHeader
        crumb={<><Link to="/research">Research</Link> / <Link to={`/clients/${run.client_id}`}>{clientName}</Link></>}
        title={`${clientName} research`}
        subtitle={[fmtDate(run.created_at), run.website, run.finished_at && run.started_at ? `took ${fmtDuration(run.started_at, run.finished_at)}` : null].filter(Boolean).join(' · ')}
        actions={
          <>
            <Chip tone={tone} dot={run.status === 'running'}>{label}</Chip>
            {(run.status === 'ready' || run.status === 'failed' || run.status === 'needs_input') && (
              <Link to={`/research/new?client=${run.client_id}${run.status === 'needs_input' ? '&paste=1' : ''}`}>
                <Button variant={run.status === 'ready' ? 'secondary' : 'primary'}>{run.status === 'needs_input' ? 'Paste text and run again' : 'Run again'}</Button>
              </Link>
            )}
          </>
        }
      />
      {run.status === 'queued' || run.status === 'running' ? (
        <Running run={run} />
      ) : run.status !== 'ready' ? (
        <Note tone={run.status === 'needs_input' ? 'warn' : 'bad'} title={run.status === 'needs_input' ? 'We need the page text' : 'The run stopped'}>
          {run.error}
        </Note>
      ) : (
        <Ready run={run} tab={tab} setTab={setTab} />
      )}
    </>
  )
}

function Running({ run }: { run: RunRow }) {
  const current = STEPS.findIndex((s) => s.key === run.step)
  return (
    <div className="grid grid-cols-[1fr_360px] gap-6">
      <Card title="Working on it" subtitle="You can leave this page. The run keeps going and this page updates on its own.">
        <ol className="flex flex-col gap-3">
          {STEPS.map((s, i) => {
            const done = current > i
            const active = current === i
            return (
              <li key={s.key} className="flex items-center gap-3 text-sm">
                <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border text-xs', done ? 'border-ink bg-ink text-canvas' : active ? 'border-ink' : 'border-line text-fg-3')}>
                  {done ? <Check className="size-3.5" /> : active ? <span className="size-2.5 animate-spin rounded-full border-2 border-ink border-t-transparent" /> : i + 1}
                </span>
                <span className={cx(active ? 'font-medium' : done ? 'text-fg-2' : 'text-fg-3')}>{s.label}</span>
                {active && run.progress && <span className="text-xs text-fg-3">{run.progress}</span>}
              </li>
            )
          })}
        </ol>
      </Card>
      <Note title="What happens next">When the run is ready you can read the report, check each fact against its page, and copy the meeting questions.</Note>
    </div>
  )
}

function Ready({ run, tab, setTab }: { run: RunRow; tab: Tab; setTab: (t: Tab) => void }) {
  const claims = run.claims ?? []
  const questions = run.questions ?? []
  const s = run.stats ?? {}
  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="w-fit">
          <Segmented<Tab>
            label="View"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'report', label: 'Report' },
              { value: 'claims', label: `Claims · ${claims.length}` },
              { value: 'questions', label: `Questions · ${questions.length}` },
              { value: 'pages', label: 'Pages read' },
            ]}
          />
        </div>
        {tab === 'report' && <Report run={run} />}
        {tab === 'claims' && <Claims run={run} />}
        {tab === 'questions' && <Questions questions={questions} />}
        {tab === 'pages' && <Pages runId={run.id} />}
      </div>
      <div className="flex flex-col gap-6">
        <Card title="This run">
          <div className="flex flex-col gap-2.5 text-sm">
            <Stat label="Client pages read" value={s.pages} />
            {!!(s as Record<string, number>).uploads && <Stat label="Exports used" value={(s as Record<string, number>).uploads} />}
            <Stat label="Competitor pages read" value={s.competitor_pages} />
            {!!(s as Record<string, number>).google_profiles && <Stat label="Google profiles" value={(s as Record<string, number>).google_profiles} />}
            <Stat label="Facts in the report" value={s.included} />
            <Stat label="Became questions" value={claims.filter((c) => c.status === 'question').length} />
            <Stat label="Dropped by checks" value={s.dropped} />
            <Stat label="Cost" value={run.cost_usd !== null ? `$${Number(run.cost_usd).toFixed(2)}` : undefined} />
          </div>
        </Card>
        <Note title="Internal">The questions and claim review are for the agency. Only the report is written for the client.</Note>
        {run.warnings?.length > 0 && (
          <Card title="Checks and warnings" subtitle="Blocks removed and pages that could not be read">
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-auto text-xs text-fg-2">
              {run.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-fg-2">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  )
}

// --- Report ----------------------------------------------------------------------

function Report({ run }: { run: RunRow }) {
  const [refs, setRefs] = useState(false)
  const sections = run.report?.sections ?? []
  if (!sections.length) return <Card><Empty title="Nothing passed the checks">The site gave too little we could verify. Use the questions for the first meeting.</Empty></Card>
  return (
    <Card>
      <div className="mb-6 flex items-center gap-3 border-b border-line pb-4">
        <div className="flex-1">
          <div className="text-xs font-medium tracking-wide text-fg-3 uppercase">Brand intelligence report · v1</div>
          <div className="font-serif text-2xl">{run.report?.client.name}</div>
        </div>
        <span className="text-xs text-fg-2">Show sources</span>
        <Toggle label="Show sources" checked={refs} onChange={setRefs} />
      </div>
      <div className="flex flex-col gap-10">
        {sections.map((s, i) => <SectionView key={s.key} n={i + 1} section={s} refs={refs} />)}
      </div>
    </Card>
  )
}

function Refs({ ids, on }: { ids?: string[]; on: boolean }) {
  if (!on || !ids?.length) return null
  return <span className="ml-1 align-super text-[10px] text-casal">{ids.join(' ')}</span>
}

function SectionView({ n, section, refs }: { n: number; section: Section; refs: boolean }) {
  return (
    <section>
      <div className="mb-1 text-xs font-semibold text-fg-3">{String(n).padStart(2, '0')}</div>
      <div className="mb-4 h-0.5 w-8 bg-highlight" />
      <h2 className="mb-4 font-serif text-[22px] leading-7">{section.title}</h2>
      <div className="flex flex-col gap-4 text-[15px] leading-6">
        {section.blocks.map((b, i) => <BlockView key={i} block={b} refs={refs} />)}
      </div>
    </section>
  )
}

function BlockView({ block: b, refs }: { block: Block; refs: boolean }) {
  switch (b.type) {
    case 'paragraph':
      return <p className={cx(b.lead && 'text-lg leading-7')}>{b.text}<Refs ids={b.claim_ids} on={refs} /></p>
    case 'callout':
      return (
        <div className="rounded-md border-l-2 border-ink bg-subtle px-4 py-3">
          {b.title && <div className="mb-1 text-sm font-semibold">{b.title}</div>}
          <p>{b.text}<Refs ids={b.claim_ids} on={refs} /></p>
        </div>
      )
    case 'bullets':
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {b.items.map((it, i) => <li key={i}>{it.text}<Refs ids={it.claim_ids} on={refs} /></li>)}
        </ul>
      )
    case 'facts':
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {b.items.map((it, i) => (
            <div key={i} className="rounded-md border border-line px-3.5 py-3">
              <div className="font-serif text-2xl">{it.value}</div>
              <div className="text-xs text-fg-2">{it.label}<Refs ids={it.claim_ids} on={refs} /></div>
            </div>
          ))}
        </div>
      )
    case 'table':
      return (
        <div className="overflow-hidden rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-subtle">
              <tr>{b.headers.map((h, i) => <th key={i} className="px-3.5 py-2 text-[11px] font-semibold tracking-wide text-fg-2 uppercase">{h}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-t border-line align-top">
                  {r.map((c, j) => <td key={j} className="px-3.5 py-2.5">{c.text}<Refs ids={c.claim_ids} on={refs} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

// --- Claims (claim review) --------------------------------------------------------------

type ClaimFilter = 'included' | 'question' | 'dropped' | 'all'

const EVIDENCE_LABEL: Record<string, [string, Tone]> = {
  stated: ['On their site', 'ok'],
  corroborated: ['Two sources', 'ok'],
  client_confirmed: ['Client confirmed', 'ok'],
  observed_absence: ['Not mentioned', 'neutral'],
  inferred: ['Our inference', 'warn'],
  single_external: ['One outside source', 'warn'],
}

const FACT_TYPE: Record<string, string> = { offerings: 'service', customers: 'testimonial', reviews: 'number', overview: 'number', audiences: 'service', aspirations: 'story' }

function Claims({ run }: { run: RunRow }) {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<ClaimFilter>('included')
  const claims = run.claims ?? []
  const shown = filter === 'all' ? claims : claims.filter((c) => c.status === filter)
  const facts = useQuery({
    queryKey: ['facts-texts', run.client_id],
    queryFn: async () => {
      const { data } = await supabase.from('facts').select('text').eq('client_id', run.client_id)
      return new Set((data ?? []).map((f) => f.text as string))
    },
  })
  const add = useMutation({
    mutationFn: async (c: ResearchClaim) => {
      const { data: client } = await supabase.from('clients').select('workspace_id').eq('id', run.client_id).single()
      const { error } = await supabase.from('facts').insert({
        client_id: run.client_id,
        workspace_id: client!.workspace_id,
        text: c.text,
        type: FACT_TYPE[c.section] ?? 'service',
        source: c.source_url || null,
        status: 'approved',
        research_run_id: run.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['facts-texts', run.client_id] })
      qc.invalidateQueries({ queryKey: ['client', run.client_id] })
    },
  })
  const counts = (s: ClaimFilter) => (s === 'all' ? claims.length : claims.filter((c) => c.status === s).length)
  return (
    <Card flush className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <p className="flex-1 text-xs text-fg-2">Every fact Claude found, with the exact words and page it came from. Add the useful ones to the client's facts so posts can use them.</p>
        <Segmented<ClaimFilter>
          label="Filter claims"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'included', label: `In report ${counts('included')}` },
            { value: 'question', label: `Questions ${counts('question')}` },
            { value: 'dropped', label: `Dropped ${counts('dropped')}` },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      {add.error && <div className="px-5 pb-3"><Note tone="bad">{(add.error as Error).message}</Note></div>}
      <Table head={['', 'Claim', 'Source', 'Evidence', '']}>
        {shown.map((c) => {
          const [ev, evTone] = EVIDENCE_LABEL[c.evidence] ?? [c.evidence, 'neutral']
          const inFacts = facts.data?.has(c.text)
          return (
            <tr key={c.id} className="align-top">
              <td className="text-xs text-fg-3">{c.id}</td>
              <td className="max-w-md">
                <div>{c.text}</div>
                {c.quote && <div className="mt-1 text-xs text-fg-2">“{c.quote}”</div>}
                {c.note && <div className="mt-1 text-xs text-fg-3">{c.note}</div>}
                {c.competitor && <div className="mt-1"><Chip>{c.competitor}</Chip></div>}
              </td>
              <td className="max-w-48 text-xs">
                {c.source_url?.startsWith('http') ? (
                  <a href={c.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-fg-2 hover:text-ink">
                    {c.source_title || new URL(c.source_url).pathname} <ExternalLink className="size-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-fg-2">{c.source_title || c.source_url || 'Pages reviewed'}</span>
                )}
              </td>
              <td>
                <Chip tone={evTone}>{ev}</Chip>
                {c.evidence !== 'observed_absence' && !c.source_url.startsWith('google') && (
                  <div className={cx('mt-1 text-xs', c.verified ? 'text-ok' : 'text-bad')}>{c.verified ? 'Quote found' : 'Quote not found'}</div>
                )}
              </td>
              <td className="text-right">
                {c.status === 'included' && !c.competitor &&
                  (inFacts ? (
                    <span className="text-xs text-fg-3">In facts</span>
                  ) : (
                    <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => add.mutate(c)} loading={add.isPending && add.variables?.id === c.id}>Add to facts</Button>
                  ))}
              </td>
            </tr>
          )
        })}
      </Table>
      {!shown.length && <div className="p-8 text-center text-sm text-fg-3">Nothing here.</div>}
    </Card>
  )
}

// --- Questions --------------------------------------------------------------------------

function questionsText(qs: Question[]) {
  return QUESTION_TOPICS.filter((t) => qs.some((q) => q.topic === t))
    .map((t) => `${t}\n` + qs.filter((q) => q.topic === t).map((q) => `- ${q.priority === 'must' ? '[Must] ' : ''}${q.question}\n  Why: ${q.trigger}\n  Site says: ${q.site_says}`).join('\n'))
    .join('\n\n')
}

function Questions({ questions }: { questions: Question[] }) {
  const [copied, setCopied] = useState(false)
  const byTopic = useMemo(() => {
    const order = (q: Question) => (q.priority === 'must' ? 0 : 1)
    return QUESTION_TOPICS.map((t) => ({ topic: t, items: questions.filter((q) => q.topic === t).sort((a, b) => order(a) - order(b)) })).filter((g) => g.items.length)
  }, [questions])
  return (
    <Card
      title="Questions for the first meeting"
      subtitle={`${questions.filter((q) => q.priority === 'must').length} must ask · ${questions.length} in all`}
      action={
        <Button onClick={() => navigator.clipboard.writeText(questionsText(questions)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy all'}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {byTopic.map((g) => (
          <div key={g.topic}>
            <h3 className="mb-2 text-sm font-semibold">{g.topic}</h3>
            <ol className="flex flex-col divide-y divide-line rounded-md border border-line">
              {g.items.map((q) => (
                <li key={q.id} className="px-3.5 py-3">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-sm font-medium">{q.question}</span>
                    {q.priority === 'must' && <Chip tone="accent">Must ask</Chip>}
                  </div>
                  <div className="mt-1 text-xs text-fg-2">Why: {q.trigger}</div>
                  <div className="text-xs text-fg-3">Site says: {q.site_says}</div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Card>
  )
}

// --- Pages ------------------------------------------------------------------------------

const KIND: Record<string, string> = { client: 'Client site', competitor: 'Competitor', pasted: 'Pasted text', upload: 'Export' }

function Pages({ runId }: { runId: string }) {
  const { data } = usePages(runId)
  return (
    <Card flush className="overflow-hidden">
      <Table head={['Ref', 'Page', 'Type', 'Words']}>
        {(data ?? []).map((p) => (
          <tr key={p.id}>
            <td className="text-xs text-fg-3">{p.ref}</td>
            <td className="max-w-lg">
              <div className="truncate font-medium">{p.title || p.url}</div>
              {p.url.startsWith('http') ? <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-fg-3 hover:text-ink">{p.url}</a> : <div className="text-xs text-fg-3">{p.url}</div>}
            </td>
            <td>{p.competitor ? <Chip>{p.competitor}</Chip> : <Chip tone={p.kind === 'upload' ? 'accent' : 'neutral'}>{KIND[p.kind]}</Chip>}</td>
            <td>{p.words}</td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}
