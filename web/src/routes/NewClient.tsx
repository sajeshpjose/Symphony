import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { CHANNEL_LABELS, CHANNELS, type Channel } from '@symph/core'
import { Sparkles } from 'lucide-react'
import { Button, Card, Field, Input, Note, PageHeader, Pill, Textarea, cx } from '../components/ui'
import { api } from '../lib/api'
import { useClientBundle } from '../lib/client'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'

const STEPS = ['Business', 'Voice and tone', 'Rules and claims', 'Facts', 'Examples']

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap gap-2">
      {STEPS.map((s, i) => (
        <li key={s} className={cx('flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5', i === current && 'bg-tint')}>
          <span
            className={cx(
              'grid size-[22px] place-items-center rounded-full text-xs font-medium',
              i < current ? 'bg-ok text-canvas' : i === current ? 'bg-ink text-canvas' : 'bg-subtle text-fg-2',
            )}
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={cx(i === current ? 'font-medium' : 'text-fg-2')}>{s}</span>
        </li>
      ))}
    </ol>
  )
}

type Suggestion = { industry: string; location: string; sells: string; audience: string; run_date: string }

// /clients/new: quick add (name, website, industry, location); research can run straight after.
// /clients/:id/edit: business details editor. ?all=1 continues into the other profile steps.
export function NewClient() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const wizard = params.get('all') === '1'
  const qc = useQueryClient()
  const { data: ws } = useWorkspace()
  const { id } = useParams() // set when editing an existing client
  const { data: existing } = useClientBundle(id)
  const [f, setF] = useState({ name: '', website: '', industry: '', location: '', sells: '', audience: '', goal: '', success_measure: '' })
  const [channels, setChannels] = useState<Channel[]>([...CHANNELS])
  useEffect(() => {
    if (!existing) return
    const c = existing.client
    setF({ name: c.name, website: c.website ?? '', industry: c.industry ?? '', location: c.location ?? '', sells: c.sells ?? '', audience: c.audience ?? '', goal: c.goal ?? '', success_measure: c.success_measure ?? '' })
    setChannels(c.social_channels as Channel[])
  }, [existing])
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  // Fill from research: suggestions from the latest ready research run, only into empty fields.
  const hasResearch = useQuery({
    queryKey: ['latest-ready-run', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('research_runs').select('id').eq('client_id', id!).eq('status', 'ready').limit(1)
      return !!data?.length
    },
  })
  const [filled, setFilled] = useState<string[] | null>(null)
  const suggest = useMutation({
    mutationFn: () => api<Suggestion>('suggest-business', { clientId: id }),
    onSuccess: (sg) => {
      const keys = (['industry', 'location', 'sells', 'audience'] as const).filter((k) => !f[k].trim() && sg[k]?.trim())
      setF({ ...f, ...Object.fromEntries(keys.map((k) => [k, sg[k].trim()])) })
      setFilled(keys.map((k) => ({ industry: 'industry', location: 'location', sells: 'what they sell', audience: 'who they write for' })[k]))
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      if (!ws) throw new Error('Workspace not loaded yet')
      const row = { ...f, website: f.website.replace(/^https?:\/\//, '') || null, social_channels: channels }
      if (id) {
        const { error } = await supabase.from('clients').update(row).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...row, workspace_id: ws.id, status: 'active' })
        .select('id')
        .single()
      if (error) throw error
      const { error: vErr } = await supabase.from('voice_profiles').insert({ client_id: data.id, workspace_id: ws.id })
      if (vErr) throw vErr
      return data.id as string
    },
    onSuccess: (cid) => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', cid] })
      nav(id && wizard ? `/clients/${cid}?step=2&all=1` : `/clients/${cid}`)
    },
  })

  const editing = !!id
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <PageHeader
        crumb={editing ? <Link to={`/clients/${id}`}>Clients  /  {existing?.client.name ?? ''}</Link> : <Link to="/clients">Clients</Link>}
        title={editing ? 'Business details' : 'Add client'}
        subtitle={
          editing
            ? wizard
              ? `Step 1 of 5 · Business for ${existing?.client.name ?? ''}`
              : 'What they do, who they serve and the goal. Needed before writing content.'
            : 'Name and website are enough to run research. Add the rest whenever you need it.'
        }
        actions={
          <>
            <Link to={editing ? `/clients/${id}` : '/clients'}><Button type="button">Cancel</Button></Link>
            <Button variant="primary" type="submit" loading={save.isPending} disabled={!f.name.trim()}>
              {editing ? (wizard ? 'Continue' : 'Save') : 'Add client'}
            </Button>
          </>
        }
      />
      {editing && wizard && <Stepper current={0} />}
      {save.error && <div className="mb-4"><Note tone="bad">{(save.error as Error).message}</Note></div>}
      {!editing ? (
        <div className="grid grid-cols-[1fr_360px] gap-6">
          <Card title="Client">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Business name"><Input required autoFocus value={f.name} onChange={set('name')} placeholder="Birch & Co. Landscaping" /></Field>
              <Field label="Website"><Input value={f.website} onChange={set('website')} placeholder="birchandco.ca" /></Field>
              <Field label="Industry (optional)"><Input value={f.industry} onChange={set('industry')} placeholder="Landscaping and lawn care" /></Field>
              <Field label="Location and service area (optional)"><Input value={f.location} onChange={set('location')} placeholder="Oakville, Burlington, Milton" /></Field>
            </div>
          </Card>
          <Card title="What happens next">
            <ol className="flex flex-col gap-3">
              {['Run research on their website', 'Add business details and voice, using what research found', 'Get the next 5 blog topics', 'Claude writes each post and its social copy'].map((s, i) => (
                <li key={s} className="flex items-center gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-tint text-xs font-medium text-casal">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_360px] gap-6">
          <div className="flex flex-col gap-6">
            <Card
              title="Business"
              subtitle="What they do and who they serve"
              action={
                <Button
                  type="button"
                  onClick={() => suggest.mutate()}
                  loading={suggest.isPending}
                  disabled={!hasResearch.data}
                  title={hasResearch.data ? 'Suggest from the latest research report' : 'Run research first'}
                >
                  <Sparkles className="size-4" /> Fill from research
                </Button>
              }
            >
              {suggest.error && <div className="mb-3"><Note tone="bad">{(suggest.error as Error).message}</Note></div>}
              {filled && (
                <div className="mb-3">
                  <Note tone={filled.length ? 'accent' : 'warn'}>
                    {filled.length ? `Filled ${filled.join(', ')} from research. Check them, then save.` : 'Research had nothing to add to the empty fields.'}
                  </Note>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Business name"><Input required value={f.name} onChange={set('name')} /></Field>
                <Field label="Website"><Input value={f.website} onChange={set('website')} placeholder="birchandco.ca" /></Field>
                <Field label="Industry"><Input value={f.industry} onChange={set('industry')} placeholder="Landscaping and lawn care" /></Field>
                <Field label="Location and service area"><Input value={f.location} onChange={set('location')} placeholder="Oakville, Burlington, Milton" /></Field>
                <Field label="What they sell" help="Needed for content" className="col-span-2"><Textarea value={f.sells} onChange={set('sells')} placeholder="Spring and fall clean-ups, weekly lawn care…" /></Field>
                <Field label="Who they write for" help="Needed for content" className="col-span-2"><Textarea value={f.audience} onChange={set('audience')} placeholder="Homeowners in Halton with busy schedules…" /></Field>
              </div>
            </Card>
            <Card title="Goal" subtitle="Topics are picked to support this goal">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Main goal for the first 3 months"><Input value={f.goal} onChange={set('goal')} placeholder="More booked spring clean-ups" /></Field>
                <Field label="How you will judge it"><Input value={f.success_measure} onChange={set('success_measure')} placeholder="More quote requests from the blog" /></Field>
              </div>
              <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-fg-2">Social copy for</div>
                <div className="flex gap-2">
                  {CHANNELS.map((c) => (
                    <Pill key={c} on={channels.includes(c)} onClick={() => setChannels(channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c])}>
                      {CHANNEL_LABELS[c]}
                    </Pill>
                  ))}
                </div>
              </div>
            </Card>
          </div>
          <Note title="From research">Fill from research suggests the industry, area, what they sell and who they serve from the facts in the latest report. It only fills empty fields.</Note>
        </div>
      )}
    </form>
  )
}
