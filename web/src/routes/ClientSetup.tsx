// Content profile editors: Voice and tone, Rules and claims, Facts, Examples (steps 2 to 5).
// Business details (step 1) is NewClient.tsx. Opened one at a time from the client page, or in order
// with "Set it all up" (?all=1). Each step saves on Save or Continue; facts and examples save as you add them.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  CHANNEL_LABELS,
  CHANNELS,
  formalityLabel,
  humorLabel,
  lengthLabel,
  lintText,
  VOICE_TRAITS,
  type VoiceProfile,
} from '@symph/core'
import { Button, Card, Chip, Field, Input, Note, PageHeader, Pill, Segmented, Select, Slider, TagInput, Textarea, Toggle } from '../components/ui'
import { api } from '../lib/api'
import type { ClientRow, ExampleRow, FactRow, VoiceRow } from '../lib/client'
import { supabase } from '../lib/supabase'
import { Stepper } from './NewClient'

type Bundle = { client: ClientRow; voice: VoiceRow | null; examples: ExampleRow[]; facts: FactRow[] }
const STEP_NAMES = ['Business', 'Voice and tone', 'Rules and claims', 'Facts', 'Examples']

function useInvalidate(id: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['client', id] })
    qc.invalidateQueries({ queryKey: ['clients'] })
  }
}

async function advance(client: ClientRow, to: number) {
  if (client.setup_step >= to) return
  const { error } = await supabase.from('clients').update({ setup_step: to }).eq('id', client.id)
  if (error) throw error
}

// true when one step is opened on its own from the client page
const SingleStep = createContext(false)

function Shell({ step, client, onBack, onNext, nextLabel = 'Continue', saving, error, children }: {
  step: number
  client: ClientRow
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  saving?: boolean
  error?: unknown
  children: ReactNode
}) {
  const single = useContext(SingleStep)
  return (
    <>
      <PageHeader
        crumb={<Link to={`/clients/${client.id}`}>Clients  /  {client.name}</Link>}
        title={single ? STEP_NAMES[step - 1] : 'Set up content profile'}
        subtitle={single ? `For ${client.name}` : `Step ${step} of 5 · ${STEP_NAMES[step - 1]} for ${client.name}`}
        actions={
          <>
            <Button type="button" onClick={onBack}>{single ? 'Cancel' : 'Back'}</Button>
            <Button variant="primary" onClick={onNext} loading={saving}>{single ? 'Save' : nextLabel}</Button>
          </>
        }
      />
      {!single && <Stepper current={step - 1} />}
      {!!error && <div className="mb-4"><Note tone="bad">{(error as Error).message}</Note></div>}
      {children}
    </>
  )
}

export function ClientSetup({ bundle, step, goTo, single = false }: { bundle: Bundle; step: number; goTo: (s: number) => void; single?: boolean }) {
  const body =
    step === 2 ? <VoiceStep bundle={bundle} goTo={goTo} /> : step === 3 ? <RulesStep bundle={bundle} goTo={goTo} /> : step === 4 ? <FactsStep bundle={bundle} goTo={goTo} /> : <ExamplesStep bundle={bundle} goTo={goTo} />
  return <SingleStep.Provider value={single}>{body}</SingleStep.Provider>
}

// ---------------------------------------------------------------- Step 2

type VoiceDraft = Pick<VoiceProfile, 'formality' | 'humor' | 'sentence_length' | 'traits' | 'point_of_view' | 'spelling' | 'emoji' | 'hashtags' | 'summary'>

function VoiceStep({ bundle, goTo }: { bundle: Bundle; goTo: (s: number) => void }) {
  const { client, voice } = bundle
  const invalidate = useInvalidate(client.id)
  const [d, setD] = useState<VoiceDraft>(() => ({
    formality: voice?.formality ?? 40,
    humor: voice?.humor ?? 30,
    sentence_length: voice?.sentence_length ?? 35,
    traits: voice?.traits ?? [],
    point_of_view: voice?.point_of_view ?? 'we',
    spelling: voice?.spelling ?? 'canadian',
    emoji: voice?.emoji ?? 'light',
    hashtags: voice?.hashtags ?? '1-2',
    summary: voice?.summary ?? '',
  }))
  const [topic, setTopic] = useState('')
  const set = <K extends keyof VoiceDraft>(k: K, v: VoiceDraft[K]) => setD((x) => ({ ...x, [k]: v }))

  const sample = useMutation({
    mutationFn: () => api<{ sample: string; summary: string }>('voice-sample', { clientId: client.id, voice: d, topic: topic || undefined }),
    onSuccess: (r) => set('summary', r.summary),
  })

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('voice_profiles').update(d).eq('client_id', client.id)
      if (error) throw error
      await advance(client, 3)
    },
    onSuccess: () => {
      invalidate()
      goTo(3)
    },
  })

  const toggleTrait = (t: string) =>
    set('traits', d.traits.includes(t) ? d.traits.filter((x) => x !== t) : d.traits.length < 3 ? [...d.traits, t] : d.traits)

  return (
    <Shell step={2} client={client} onBack={() => goTo(1)} onNext={() => save.mutate()} saving={save.isPending} error={save.error}>
      <div className="grid grid-cols-[1fr_380px] gap-6">
        <Card>
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-[15px] font-semibold">Tone</h2>
              <p className="mb-4 text-xs text-fg-2">Drag to set how this client should sound</p>
              <div className="flex flex-col gap-5">
                <Slider label="Formality" value={d.formality} onChange={(v) => set('formality', v)} left="Casual" right="Formal" valueLabel={formalityLabel(d.formality)} />
                <Slider label="Humour" value={d.humor} onChange={(v) => set('humor', v)} left="Serious" right="Playful" valueLabel={humorLabel(d.humor)} />
                <Slider label="Sentence length" value={d.sentence_length} onChange={(v) => set('sentence_length', v)} left="Short and punchy" right="Longer and detailed" valueLabel={lengthLabel(d.sentence_length)} />
              </div>
            </div>
            <div>
              <h2 className="text-[15px] font-semibold">Voice traits</h2>
              <p className="mb-3 text-xs text-fg-2">Pick up to 3</p>
              <div className="flex flex-wrap gap-2">
                {VOICE_TRAITS.map((t) => <Pill key={t} on={d.traits.includes(t)} onClick={() => toggleTrait(t)}>{t}</Pill>)}
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-[15px] font-semibold">Who is speaking</h2>
              <Segmented
                label="Point of view"
                value={d.point_of_view}
                onChange={(v) => set('point_of_view', v)}
                options={[{ value: 'we', label: 'We (the business)' }, { value: 'i', label: 'I (the owner)' }, { value: 'you', label: 'You-focused' }, { value: 'neutral', label: 'Neutral' }]}
              />
            </div>
            <div>
              <h2 className="mb-3 text-[15px] font-semibold">Style details</h2>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Spelling"><Segmented label="Spelling" value={d.spelling} onChange={(v) => set('spelling', v)} options={[{ value: 'canadian', label: 'Canadian' }, { value: 'us', label: 'US' }, { value: 'uk', label: 'UK' }]} /></Field>
                <Field label="Emoji"><Segmented label="Emoji" value={d.emoji} onChange={(v) => set('emoji', v)} options={[{ value: 'none', label: 'None' }, { value: 'light', label: 'Light' }, { value: 'often', label: 'Often' }]} /></Field>
                <Field label="Hashtags"><Segmented label="Hashtags" value={d.hashtags} onChange={(v) => set('hashtags', v)} options={[{ value: 'none', label: 'None' }, { value: '1-2', label: '1–2' }, { value: '3-5', label: '3–5' }]} /></Field>
              </div>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <Card title="Live sample" subtitle="A LinkedIn post written in this voice">
            <div className="flex flex-col gap-3">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional), e.g. fall lawn care" />
              {sample.data && <div className="rounded-md bg-subtle px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{sample.data.sample}</div>}
              {sample.error && <Note tone="bad">{(sample.error as Error).message}</Note>}
              <div className="flex items-center gap-2">
                <Chip tone="accent">Sample</Chip>
                <span className="flex-1 text-xs text-fg-3">Uses Claude Haiku, a fraction of a cent</span>
                <Button onClick={() => sample.mutate()} loading={sample.isPending}>{sample.data ? 'Regenerate' : 'Write sample'}</Button>
              </div>
            </div>
          </Card>
          <Card title="How Claude will read this" subtitle="Written with the sample. Edit it if it is off.">
            <Textarea
              value={d.summary ?? ''}
              onChange={(e) => set('summary', e.target.value)}
              placeholder="Write a sample to fill this in, or describe the voice yourself."
              className="min-h-28"
            />
          </Card>
        </div>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------- Step 3

function RulesStep({ bundle, goTo }: { bundle: Bundle; goTo: (s: number) => void }) {
  const { client, voice } = bundle
  const invalidate = useInvalidate(client.id)
  const [use, setUse] = useState(voice?.words_use ?? [])
  const [avoid, setAvoid] = useState(voice?.words_avoid ?? [])
  const [topics, setTopics] = useState(voice?.topics_avoid ?? [])
  const [claims, setClaims] = useState(voice?.claims_never ?? [])
  const [claimDraft, setClaimDraft] = useState('')
  const [disclaimer, setDisclaimer] = useState(voice?.disclaimer ?? '')
  const [regulated, setRegulated] = useState(voice?.regulated ?? false)
  const [test, setTest] = useState('')

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('voice_profiles')
        .update({ words_use: use, words_avoid: avoid, topics_avoid: topics, claims_never: claims, disclaimer: disclaimer || null, regulated })
        .eq('client_id', client.id)
      if (error) throw error
      await advance(client, 4)
    },
    onSuccess: () => {
      invalidate()
      goTo(4)
    },
  })

  const addClaim = () => {
    const c = claimDraft.trim()
    if (c) setClaims([...claims, c])
    setClaimDraft('')
  }
  const issues = test.trim() ? lintText(test, { avoid }) : []

  return (
    <Shell step={3} client={client} onBack={() => goTo(2)} onNext={() => save.mutate()} saving={save.isPending} error={save.error}>
      <div className="grid grid-cols-[1fr_380px] gap-6">
        <div className="flex flex-col gap-6">
          <Card title="Words" subtitle="Type a word and press Enter. Drafts are checked against these lists.">
            <div className="flex flex-col gap-4">
              <Field label="Words to use"><TagInput tone="ok" values={use} onChange={setUse} placeholder="neighbours, free quote…" /></Field>
              <Field label="Words to avoid"><TagInput tone="bad" values={avoid} onChange={setAvoid} placeholder="cheap, best in town…" /></Field>
              <Field label="Topics to avoid"><TagInput values={topics} onChange={setTopics} placeholder="competitor names, politics…" /></Field>
            </div>
          </Card>
          <Card title="Claims never to make" subtitle="A draft that makes one of these is flagged before you review it">
            <div className="flex flex-col gap-2">
              {claims.map((c, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md bg-subtle px-3 py-2.5">
                  <span className="flex-1">{c}</span>
                  <button type="button" aria-label="Remove claim" onClick={() => setClaims(claims.filter((_, j) => j !== i))} className="text-fg-3 hover:text-bad">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={claimDraft} onChange={(e) => setClaimDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addClaim())} placeholder="e.g. Same-day service" />
                <Button type="button" onClick={addClaim}>Add claim</Button>
              </div>
            </div>
          </Card>
          <Card title="Required disclaimer" subtitle="Added to the end of every blog post">
            <div className="flex flex-col gap-4">
              <Textarea value={disclaimer} onChange={(e) => setDisclaimer(e.target.value)} placeholder="Quotes are valid for 30 days." />
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">Regulated industry</div>
                  <div className="text-xs text-fg-2">Health, legal or finance. Claude writes more carefully.</div>
                </div>
                <Toggle label="Regulated industry" checked={regulated} onChange={setRegulated} />
              </div>
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card title="Rule check" subtitle="Paste a line to test it against the word rules">
            <div className="flex flex-col gap-3">
              <Textarea value={test} onChange={(e) => setTest(e.target.value)} placeholder="We are the best in town and our work is guaranteed." />
              {test.trim() &&
                (issues.length ? (
                  <ul className="flex flex-col gap-2">
                    {issues.map((i, k) => (
                      <li key={k} className="flex gap-2 text-sm"><span className="text-bad">✕</span>{i.message}</li>
                    ))}
                  </ul>
                ) : (
                  <Note tone="ok">Passes the word checks.</Note>
                ))}
              <p className="text-xs text-fg-3">Claims are checked by Claude when posts are written.</p>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------- Step 4

const FACT_TYPES = ['service', 'price', 'area', 'credential', 'number', 'testimonial', 'story', 'faq'] as const
const FACT_STATUS = [
  { value: 'approved', label: 'Approved', tone: 'ok' as const },
  { value: 'needs_proof', label: 'Needs proof', tone: 'warn' as const },
  { value: 'consent_needed', label: 'Consent needed', tone: 'warn' as const },
]

function FactsStep({ bundle, goTo }: { bundle: Bundle; goTo: (s: number) => void }) {
  const { client, facts } = bundle
  const invalidate = useInvalidate(client.id)
  const [draft, setDraft] = useState({ text: '', type: 'service', source: '' })

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('facts').insert({ ...draft, source: draft.source || null, client_id: client.id, workspace_id: client.workspace_id })
      if (error) throw error
    },
    onSuccess: () => {
      setDraft({ text: '', type: draft.type, source: '' })
      invalidate()
    },
  })
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FactRow> }) => {
      const { error } = await supabase.from('facts').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('facts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const next = useMutation({
    mutationFn: () => advance(client, 5),
    onSuccess: () => {
      invalidate()
      goTo(5)
    },
  })

  return (
    <Shell step={4} client={client} onBack={() => goTo(3)} onNext={() => next.mutate()} saving={next.isPending} error={add.error ?? update.error ?? remove.error}>
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <Card flush title="Approved facts" subtitle="Drafts may only state prices, numbers, credentials and quotes that are in this list" className="overflow-hidden">
          <form
            className="flex items-end gap-2 border-b border-line px-5 pb-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (draft.text.trim()) add.mutate()
            }}
          >
            <Field label="Fact" className="flex-1"><Input value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="Spring clean-up from $249 for yards up to 5,000 sq ft" /></Field>
            <Field label="Type" className="w-36">
              <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                {FACT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Source" className="w-40"><Input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="Price sheet" /></Field>
            <Button type="submit" loading={add.isPending} disabled={!draft.text.trim()}>Add</Button>
          </form>
          {facts.length === 0 ? (
            <p className="px-5 py-8 text-center text-fg-3">No facts yet. Research will suggest some, or add them here.</p>
          ) : (
            <ul>
              {facts.map((f) => (
                <li key={f.id} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div>{f.text}</div>
                    <div className="text-xs text-fg-3">{[f.type, f.source].filter(Boolean).join(' · ')}</div>
                  </div>
                  <Select className="w-44" value={f.status} onChange={(e) => update.mutate({ id: f.id, patch: { status: e.target.value as FactRow['status'] } })}>
                    {FACT_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                  <button type="button" aria-label="Delete fact" onClick={() => remove.mutate(f.id)} className="text-fg-3 hover:text-bad"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card title="How facts are used">
            <ul className="flex flex-col gap-2.5 text-sm">
              <li>Claude only states prices, numbers, credentials and quotes from approved facts.</li>
              <li>Facts marked "Needs proof" or "Consent needed" are never used.</li>
              <li>Testimonials need the customer's written consent.</li>
            </ul>
          </Card>
          <Note>This stops invented claims. You can skip it now and add facts after research.</Note>
        </div>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------- Step 5

function ExamplesStep({ bundle, goTo }: { bundle: Bundle; goTo: (s: number) => void }) {
  const { client, examples, voice } = bundle
  const invalidate = useInvalidate(client.id)
  const nav = useNavigate()
  const loved = examples.filter((e) => e.kind === 'loved')
  const disliked = examples.find((e) => e.kind === 'disliked')
  const [draft, setDraft] = useState({ channel: 'linkedin', body: '' })
  const [bad, setBad] = useState({ body: disliked?.body ?? '', reason: disliked?.reason ?? '' })
  useEffect(() => setBad({ body: disliked?.body ?? '', reason: disliked?.reason ?? '' }), [disliked?.id])

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('examples').insert({ kind: 'loved', channel: draft.channel, body: draft.body.trim(), client_id: client.id, workspace_id: client.workspace_id })
      if (error) throw error
    },
    onSuccess: () => {
      setDraft({ ...draft, body: '' })
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('examples').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const learn = useMutation({ mutationFn: () => api<{ points: string[] }>('learn-voice', { clientId: client.id }) })
  const addLearned = useMutation({
    mutationFn: async (points: string[]) => {
      const summary = [voice?.summary, ...points.map((p) => `- ${p}`)].filter(Boolean).join('\n')
      const { error } = await supabase.from('voice_profiles').update({ summary }).eq('client_id', client.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const finish = useMutation({
    mutationFn: async () => {
      if (bad.body.trim()) {
        if (disliked) {
          const { error } = await supabase.from('examples').update({ body: bad.body.trim(), reason: bad.reason || null }).eq('id', disliked.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('examples').insert({ kind: 'disliked', body: bad.body.trim(), reason: bad.reason || null, client_id: client.id, workspace_id: client.workspace_id })
          if (error) throw error
        }
      }
      await advance(client, 5)
    },
    onSuccess: () => {
      invalidate()
      nav(`/clients/${client.id}`)
    },
  })

  return (
    <Shell step={5} client={client} onBack={() => goTo(4)} onNext={() => finish.mutate()} nextLabel="Finish" saving={finish.isPending} error={finish.error ?? add.error}>
      <div className="grid grid-cols-[1fr_380px] gap-6">
        <div className="flex flex-col gap-6">
          <Card title="Posts they loved" subtitle="Up to three. Paste the text.">
            <div className="flex flex-col gap-3">
              {loved.map((e) => (
                <div key={e.id} className="rounded-md bg-subtle px-4 py-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    {e.channel && <Chip tone="accent">{CHANNEL_LABELS[e.channel as keyof typeof CHANNEL_LABELS] ?? e.channel}</Chip>}
                    <span className="flex-1" />
                    <button type="button" aria-label="Remove example" onClick={() => remove.mutate(e.id)} className="text-fg-3 hover:text-bad"><Trash2 className="size-4" /></button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-fg-2">{e.body}</p>
                </div>
              ))}
              {loved.length < 3 && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    {[...CHANNELS, 'blog'].map((c) => (
                      <Pill key={c} on={draft.channel === c} onClick={() => setDraft({ ...draft, channel: c })}>
                        {c === 'blog' ? 'Blog' : CHANNEL_LABELS[c as keyof typeof CHANNEL_LABELS]}
                      </Pill>
                    ))}
                  </div>
                  <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Paste a post they loved" />
                  <div><Button onClick={() => add.mutate()} loading={add.isPending} disabled={!draft.body.trim()}>Add example</Button></div>
                </div>
              )}
            </div>
          </Card>
          <Card title="One they disliked" subtitle="So Claude knows what to avoid. Optional.">
            <div className="flex flex-col gap-3">
              <Textarea value={bad.body} onChange={(e) => setBad({ ...bad, body: e.target.value })} placeholder="Paste a post they did not like" />
              <Field label="Why they disliked it"><Input value={bad.reason} onChange={(e) => setBad({ ...bad, reason: e.target.value })} placeholder="Too salesy. We never say oasis." /></Field>
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card title="What Claude learned" subtitle={loved.length ? `From ${loved.length} loved post${loved.length > 1 ? 's' : ''}` : 'Add a loved post first'}>
            <div className="flex flex-col gap-3">
              {learn.data?.points.map((p, i) => (
                <div key={i} className="flex gap-2.5 text-sm"><span className="text-ok">✓</span>{p}</div>
              ))}
              {learn.error && <Note tone="bad">{(learn.error as Error).message}</Note>}
              <div className="flex gap-2">
                <Button onClick={() => learn.mutate()} loading={learn.isPending} disabled={!loved.length}>{learn.data ? 'Learn again' : 'Learn from examples'}</Button>
                {learn.data && (
                  <Button variant="primary" onClick={() => addLearned.mutate(learn.data.points)} loading={addLearned.isPending} disabled={addLearned.isSuccess}>
                    {addLearned.isSuccess ? 'Added' : 'Add to voice profile'}
                  </Button>
                )}
              </div>
            </div>
          </Card>
          <Note>When you finish, the client is ready for research and topics.</Note>
        </div>
      </div>
    </Shell>
  )
}
