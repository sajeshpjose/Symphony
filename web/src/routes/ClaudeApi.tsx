import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MODEL_LABELS, MODELS, TASK_LABELS, TASKS, type Task } from '@symph/core'
import { Button, Card, Chip, Field, Input, Note, PageHeader, Progress, Select, Table, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'

type UsageRow = { purpose: string; calls: number; cost_usd: number }
const PURPOSE_LABELS: Record<string, string> = { ...TASK_LABELS, regenerate: 'Regenerations', voice: 'Voice samples', test: 'Key tests' }
const usd = (n: number) => `$${n.toFixed(2)}`

export function ClaudeApi() {
  const qc = useQueryClient()
  const { data: ws } = useWorkspace()
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<Record<string, string>>({})
  const [batch, setBatch] = useState<Record<string, boolean>>({})
  const [cap, setCap] = useState('10')
  const [stopAtCap, setStopAtCap] = useState(true)

  useEffect(() => {
    if (!ws) return
    setModels(ws.models)
    setBatch(ws.use_batch)
    setCap(String(ws.monthly_cap_usd))
    setStopAtCap(ws.stop_at_cap)
  }, [ws])

  const usage = useQuery({
    queryKey: ['usage'],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase.from('usage_this_month').select('purpose, calls, cost_usd').eq('workspace_id', ws!.id)
      if (error) throw error
      return (data ?? []) as UsageRow[]
    },
  })
  const spent = (usage.data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0)

  const key = useMutation({
    mutationFn: (body: { action: 'save'; apiKey: string } | { action: 'test' }) =>
      api<{ ok: boolean; message: string; ms: number }>('claude-key', body),
    onSuccess: () => {
      setApiKey('')
      qc.invalidateQueries({ queryKey: ['workspace'] })
    },
  })

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('workspaces')
        .update({ models, use_batch: batch, monthly_cap_usd: Number(cap) || 0, stop_at_cap: stopAtCap })
        .eq('id', ws!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace'] }),
  })

  const keyChip = !ws?.anthropic_key_hint ? (
    <Chip>Not connected</Chip>
  ) : ws.anthropic_key_ok ? (
    <Chip tone="ok">Connected</Chip>
  ) : ws.anthropic_key_ok === false ? (
    <Chip tone="bad">Key rejected</Chip>
  ) : (
    <Chip tone="warn">Not tested</Chip>
  )

  return (
    <>
      <PageHeader
        crumb="Settings"
        title="Claude API"
        subtitle="Connect your Anthropic API key. Every call is logged with its cost."
        actions={<Button variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={!ws}>Save</Button>}
      />
      {save.isSuccess && <div className="mb-4"><Note tone="ok">Saved.</Note></div>}
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="flex flex-col gap-6">
          <Card title="API key" subtitle="Stored encrypted in Supabase Vault. Only the last 4 characters are ever shown." action={keyChip}>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                key.mutate(apiKey ? { action: 'save', apiKey } : { action: 'test' })
              }}
            >
              <Field label="Anthropic API key" className="flex-1">
                <div className="relative">
                  <Input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={ws?.anthropic_key_hint ? `sk-ant-••••••••••••${ws.anthropic_key_hint}` : 'sk-ant-…'}
                    className="pr-9"
                  />
                  <Lock className="absolute top-2.5 right-3 size-4 text-fg-3" />
                </div>
              </Field>
              <Button type="submit" loading={key.isPending} disabled={!apiKey && !ws?.anthropic_key_hint}>
                {apiKey ? 'Save and test' : 'Test connection'}
              </Button>
            </form>
            <p className="mt-2 text-xs text-fg-3">
              {key.data
                ? `${key.data.message} · ${key.data.ms} ms`
                : key.error
                  ? (key.error as Error).message
                  : ws?.anthropic_key_tested_at
                    ? `Last test: ${new Date(ws.anthropic_key_tested_at).toLocaleString('en-CA')}`
                    : 'Create a key at console.anthropic.com → API keys.'}
            </p>
          </Card>

          <Card flush title="Models by task" subtitle="Smaller models for quick jobs keep costs low" className="overflow-hidden">
            <Table head={['Task', 'Model', 'Batch']}>
              {TASKS.map((t: Task) => (
                <tr key={t}>
                  <td className="font-medium">{TASK_LABELS[t]}</td>
                  <td className="w-56">
                    <Select value={models[t] ?? ''} onChange={(e) => setModels({ ...models, [t]: e.target.value })}>
                      {Object.values(MODELS).map((m) => (
                        <option key={m} value={m}>{MODEL_LABELS[m]}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="w-24"><Toggle label={`Batch ${t}`} checked={!!batch[t]} onChange={(v) => setBatch({ ...batch, [t]: v })} /></td>
                </tr>
              ))}
            </Table>
            <p className="border-t border-line px-5 py-3 text-xs text-fg-3">
              Batch jobs run overnight at half the price. The client voice is cached so each post does not pay for it again.
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="This month" subtitle={`${new Date().toLocaleString('en-CA', { month: 'long', year: 'numeric' })} · USD`}>
            <div className="mb-3 text-lg font-semibold">{usd(spent)} of {usd(Number(cap) || 0)}</div>
            <Progress value={(spent / (Number(cap) || 1)) * 100} />
            <div className="mt-4 flex flex-col gap-2.5">
              {(usage.data ?? []).length === 0 && <p className="text-fg-3">No calls yet this month.</p>}
              {(usage.data ?? []).map((r) => (
                <div key={r.purpose} className="flex justify-between">
                  <span className="text-fg-2">{PURPOSE_LABELS[r.purpose] ?? r.purpose}</span>
                  <span className="font-medium">{r.calls} · {usd(Number(r.cost_usd))}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Limits">
            <div className="flex flex-col gap-4">
              <Field label="Monthly cap (USD)"><Input type="number" min="0" step="1" value={cap} onChange={(e) => setCap(e.target.value)} /></Field>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">Stop new jobs at the cap</div>
                  <div className="text-xs text-fg-2">Running jobs finish</div>
                </div>
                <Toggle label="Stop at cap" checked={stopAtCap} onChange={setStopAtCap} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
