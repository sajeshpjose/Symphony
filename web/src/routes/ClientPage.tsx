import { CHANNEL_LABELS, formalityLabel, humorLabel, lengthLabel } from '@symph/core'
import { Check } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, Card, Chip, cx, Note, PageHeader } from '../components/ui'
import { useClientBundle } from '../lib/client'
import { contentReady, missingForContent, profileItems, type ProfileItem } from '../lib/profile'
import { fmtDate, STATUS_CHIP, useRuns } from '../lib/research'
import { ClientSetup } from './ClientSetup'

// Client hub: research, the content profile checklist, and the profile editors (?step=2..5, ?all=1 for all in order).
export function ClientPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data, error } = useClientBundle(id)
  const runs = useRuns(id)
  if (error) return <Note tone="bad">{(error as Error).message}</Note>
  if (!data) return null
  const { client, voice } = data

  const stepParam = Number(params.get('step'))
  const wizard = params.get('all') === '1'
  if (stepParam >= 2 && stepParam <= 5) {
    // One step on its own returns to this page; "Set it all up" walks through the steps in order.
    const goTo = (s: number) => {
      if (!wizard || s > 5) setParams({})
      else if (s === 1) nav(`/clients/${client.id}/edit?all=1`)
      else setParams({ step: String(s), all: '1' })
      window.scrollTo(0, 0)
    }
    return <ClientSetup bundle={data} step={stepParam} goTo={goTo} single={!wizard} />
  }

  const items = profileItems(data)
  const ready = contentReady(items)
  const open = (item: ProfileItem) => (item.step === 1 ? nav(`/clients/${client.id}/edit`) : setParams({ step: String(item.step) }))
  const lastRun = runs.data?.[0]

  return (
    <>
      <PageHeader
        crumb={<Link to="/clients">Clients</Link>}
        title={client.name}
        subtitle={[client.website, client.industry, client.location].filter(Boolean).join(' · ')}
        actions={
          <>
            {ready && <Link to={`/topics?client=${client.id}`}><Button>Topics</Button></Link>}
            <Link to={`/research/new?client=${client.id}`}><Button variant="primary">Run research</Button></Link>
          </>
        }
      />
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="flex flex-col gap-6">
          <Card
            title="Content profile"
            subtitle="Not needed for research. Business details and voice are needed before writing content."
            action={ready ? <Chip tone="ok">Ready for content</Chip> : <Chip tone="warn">{items.filter((i) => i.done).length} of {items.length} done</Chip>}
          >
            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {items.map((item) => (
                <li key={item.key}>
                  <button type="button" onClick={() => open(item)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-subtle">
                    <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border', item.done ? 'border-ok bg-ok text-canvas' : 'border-line-strong')}>
                      {item.done && <Check className="size-3.5" />}
                    </span>
                    <span className="flex-1">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.required && !item.done && <span className="ml-2 text-xs text-warn">Needed for content</span>}
                      <span className="block text-xs text-fg-2">{item.detail}</span>
                    </span>
                    <span className="text-xs font-medium text-fg-2">{item.done ? 'Edit' : 'Add'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={() => nav(`/clients/${client.id}/edit?all=1`)}>Set it all up</Button>
              {!ready && <span className="text-xs text-fg-3">Still needed: {missingForContent(items).map((i) => i.label.toLowerCase()).join(' and ')}</span>}
            </div>
          </Card>

          {voice?.summary && (
            <Card title="Voice" subtitle="Used in every post written for this client" action={<Button variant="ghost" onClick={() => setParams({ step: '2' })}>Edit</Button>}>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {voice.traits.map((t) => <Chip key={t} tone="accent">{t}</Chip>)}
                <Chip>{formalityLabel(voice.formality)}</Chip>
                <Chip>{humorLabel(voice.humor)}</Chip>
                <Chip>{lengthLabel(voice.sentence_length)}</Chip>
              </div>
              <p className="text-sm whitespace-pre-wrap text-fg-2">{voice.summary}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Research" subtitle="Site, competitors and exports, checked fact by fact">
            {runs.data?.length ? (
              <div className="flex flex-col gap-2.5 text-sm">
                {runs.data.slice(0, 4).map((r) => {
                  const [label, tone] = STATUS_CHIP[r.status]
                  return (
                    <Link key={r.id} to={`/research/${r.id}`} className="flex items-center justify-between gap-3 hover:underline">
                      <span className="text-fg-2">{fmtDate(r.created_at)}</span>
                      <Chip tone={tone}>{label}</Chip>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-fg-2">No research yet. Run it to get a report and the questions for your first meeting.</p>
            )}
          </Card>
          {lastRun?.status === 'ready' && !items[0].done && (
            <Note title="Use the research">
              Business details can be filled from the latest report. <button className="underline" onClick={() => nav(`/clients/${client.id}/edit`)}>Open business details</button>
            </Note>
          )}
          <Card title="Social copy for">
            <p className="text-sm">{client.social_channels.map((c) => CHANNEL_LABELS[c as keyof typeof CHANNEL_LABELS] ?? c).join(', ')}</p>
          </Card>
        </div>
      </div>
    </>
  )
}
