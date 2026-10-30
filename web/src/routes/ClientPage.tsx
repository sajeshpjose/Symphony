import { Link, useParams, useSearchParams } from 'react-router'
import { CHANNEL_LABELS, formalityLabel, humorLabel, lengthLabel } from '@symph/core'
import { Button, Card, Chip, Note, PageHeader } from '../components/ui'
import { useClientBundle } from '../lib/client'
import { ClientSetup } from './ClientSetup'

export function ClientPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { data, error } = useClientBundle(id)
  if (error) return <Note tone="bad">{(error as Error).message}</Note>
  if (!data) return null
  const { client, voice, facts, examples } = data

  const stepParam = Number(params.get('step'))
  const editing = stepParam >= 2 && stepParam <= 5
  if (client.status === 'setup' || editing) {
    const step = editing ? stepParam : Math.min(Math.max(client.setup_step, 2), 5)
    const goTo = (s: number) => {
      if (s === 1) window.location.assign(`/clients/${client.id}/edit`)
      else setParams({ step: String(s) })
      window.scrollTo(0, 0)
    }
    return <ClientSetup bundle={data} step={step} goTo={goTo} />
  }

  const approved = facts.filter((f) => f.status === 'approved').length
  const edit = (s: number) => setParams({ step: String(s) })

  return (
    <>
      <PageHeader
        crumb={<Link to="/clients">Clients</Link>}
        title={client.name}
        subtitle={[client.website, client.industry, client.location].filter(Boolean).join(' · ')}
        actions={<Button variant="primary" disabled title="Coming in the next build step">Run research</Button>}
      />
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="flex flex-col gap-6">
          <Card title="Voice" subtitle="Used in every post written for this client" action={<Button variant="ghost" onClick={() => edit(2)}>Edit</Button>}>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {voice?.traits.map((t) => <Chip key={t} tone="accent">{t}</Chip>)}
              {voice && <Chip>{formalityLabel(voice.formality)}</Chip>}
              {voice && <Chip>{humorLabel(voice.humor)}</Chip>}
              {voice && <Chip>{lengthLabel(voice.sentence_length)}</Chip>}
            </div>
            <p className="text-sm whitespace-pre-wrap text-fg-2">{voice?.summary || 'No voice summary yet.'}</p>
          </Card>
          <Card title="Rules" subtitle="What to use, avoid and never claim" action={<Button variant="ghost" onClick={() => edit(3)}>Edit</Button>}>
            <div className="flex flex-col gap-3 text-sm">
              {voice?.words_use.length ? <div className="flex flex-wrap gap-1.5">{voice.words_use.map((w) => <Chip key={w} tone="ok">{w}</Chip>)}</div> : null}
              {voice?.words_avoid.length ? <div className="flex flex-wrap gap-1.5">{voice.words_avoid.map((w) => <Chip key={w} tone="bad">{w}</Chip>)}</div> : null}
              <div className="text-fg-2">{voice?.claims_never.length ?? 0} claims never to make{voice?.disclaimer ? ' · disclaimer set' : ''}</div>
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card title="Set up">
            <div className="flex flex-col gap-2.5 text-sm">
              <Row label="Business" value="Done" onClick={() => window.location.assign(`/clients/${client.id}/edit`)} />
              <Row label="Facts" value={`${approved} approved`} onClick={() => edit(4)} />
              <Row label="Examples" value={`${examples.filter((e) => e.kind === 'loved').length} loved`} onClick={() => edit(5)} />
              <Row label="Social copy for" value={client.social_channels.map((c) => CHANNEL_LABELS[c as keyof typeof CHANNEL_LABELS] ?? c).join(', ')} />
            </div>
          </Card>
          <Note title="Next: research">Research runs as a long job on Trigger.dev. It is being built next.</Note>
        </div>
      </div>
    </>
  )
}

function Row({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-2">{label}</span>
      {onClick ? <button className="font-medium underline-offset-4 hover:underline" onClick={onClick}>{value}</button> : <span className="font-medium">{value}</span>}
    </div>
  )
}
