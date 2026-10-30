import { useMutation, useQuery } from '@tanstack/react-query'
import { importUpload, type Imported } from '@symph/core'
import { FileUp, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Card, Chip, Field, Input, Note, PageHeader, Select, TagInput, Textarea } from '../components/ui'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../lib/workspace'

type ClientOpt = { id: string; name: string; website: string | null; workspace_id: string; status: string }
type Pending = Imported & { original: File }

// Reads a file in the browser and works out what it is.
async function readUpload(file: File, clientName: string): Promise<Imported> {
  if (/\.xlsx?$/i.test(file.name)) {
    const { default: readExcelFile } = await import('read-excel-file/browser')
    const sheets = (await readExcelFile(file)) as { sheet: string; data: unknown[][] }[]
    return importUpload({ file: file.name, sheets, clientName })
  }
  return importUpload({ file: file.name, text: await file.text(), clientName })
}

const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120)

// M3.1 New research run
export function NewResearch() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: ws } = useWorkspace()
  const clients = useQuery({
    queryKey: ['client-options'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, website, workspace_id, status').order('name')
      if (error) throw error
      return data as ClientOpt[]
    },
  })
  const [clientId, setClientId] = useState(params.get('client') ?? '')
  const client = clients.data?.find((c) => c.id === clientId)
  // null means: use the client's saved website
  const [websiteEdit, setWebsite] = useState<string | null>(null)
  const website = websiteEdit ?? client?.website ?? ''
  const [competitors, setCompetitors] = useState<string[]>([])
  const [pasted, setPasted] = useState('')
  const [showPaste, setShowPaste] = useState(params.get('paste') === '1')
  const [uploads, setUploads] = useState<Pending[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])

  const addFiles = async (files: FileList | null) => {
    if (!files || !client) return
    const errors: string[] = []
    const added: Pending[] = []
    for (const f of Array.from(files)) {
      if (f.size > 20_000_000) {
        errors.push(`${f.name}: larger than 20 MB`)
        continue
      }
      try {
        added.push({ ...(await readUpload(f, client.name)), original: f })
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message}`)
      }
    }
    setUploads((u) => [...u.filter((x) => !added.some((a) => a.file === x.file)), ...added])
    setUploadErrors(errors)
  }

  const start = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('Pick a client')
      const stamp = Date.now()
      const sent = []
      for (const u of uploads) {
        const path = `${client.workspace_id}/${client.id}/research/${stamp}-${safeName(u.file)}`
        const { error } = await supabase.storage.from('uploads').upload(path, u.original, { upsert: false })
        if (error) throw new Error(`Could not upload ${u.file}: ${error.message}`)
        sent.push({ kind: u.kind, file: u.file, label: u.label, path, text: u.text, flags: u.flags })
      }
      return api<{ runId: string }>('research-start', {
        clientId: client.id,
        website: website.trim() || undefined,
        competitors,
        pastedText: pasted.trim() || undefined,
        uploads: sent,
      })
    },
    onSuccess: ({ runId }) => navigate(`/research/${runId}`),
  })

  const noKey = ws && !ws.anthropic_key_hint
  return (
    <>
      <PageHeader crumb={<Link to="/research">Research</Link>} title="New research run" subtitle="Takes a few minutes. You can leave this page; the run keeps going." />
      {noKey && (
        <div className="mb-4">
          <Note tone="warn" title="Connect Claude first">Add your Anthropic API key in <Link className="underline" to="/settings">Settings</Link>.</Note>
        </div>
      )}
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="flex flex-col gap-6">
          <Card title="Client and website">
            <div className="flex flex-col gap-4">
              <Field label="Client">
                <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setWebsite(null); setUploads([]) }}>
                  <option value="">Choose a client…</option>
                  {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Website" help="Claude reads up to 25 pages, following links from the homepage.">
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" />
              </Field>
              <Field label="Competitors you know (optional)" help="Names or web addresses. Claude also searches for others.">
                <TagInput values={competitors} onChange={setCompetitors} placeholder="Type a name and press Enter" />
              </Field>
              {showPaste ? (
                <Field label="Page text" help="Use this when the site cannot be read. Paste the homepage, services and about pages.">
                  <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} className="min-h-40" />
                </Field>
              ) : (
                <button type="button" className="w-fit text-xs text-fg-2 underline-offset-4 hover:underline" onClick={() => setShowPaste(true)}>
                  Site will not load? Paste the page text instead
                </button>
              )}
            </div>
          </Card>

          <Card title="Data exports (optional)" subtitle="The client's own numbers. Each figure in the report is traced back to the file.">
            <label
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-line-strong px-6 py-8 text-center ${client ? 'hover:bg-subtle' : 'cursor-not-allowed opacity-50'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
            >
              <FileUp className="size-5 text-fg-2" />
              <span className="text-sm font-medium">{client ? 'Drop files or click to choose' : 'Choose a client first'}</span>
              <span className="text-xs text-fg-3">GA4 overview CSV · Search Console queries or pages · Meta Ads report · reviews export · social snapshot</span>
              <input type="file" multiple disabled={!client} accept=".csv,.xlsx,.xls,.json" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            </label>
            {uploadErrors.map((e) => <p key={e} className="mt-2 text-xs text-bad">{e}</p>)}
            {uploads.length > 0 && (
              <ul className="mt-4 flex flex-col divide-y divide-line rounded-md border border-line">
                {uploads.map((u) => (
                  <li key={u.file} className="flex items-start gap-3 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Chip tone="accent">{u.label}</Chip>
                        <span className="truncate text-sm">{u.file}</span>
                      </div>
                      <div className={`mt-1 text-xs ${u.flags?.tracking_warning ? 'text-warn' : 'text-fg-2'}`}>{u.summary.join(' · ')}</div>
                    </div>
                    <button type="button" aria-label={`Remove ${u.file}`} className="text-fg-3 hover:text-ink" onClick={() => setUploads((x) => x.filter((y) => y.file !== u.file))}>
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="What you get">
            <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-fg-2">
              <li>A report with only facts we can show a source for</li>
              <li>A claim review: every fact, its quote and page</li>
              <li>15 to 30 questions for the first client meeting</li>
              <li>Competitors that share at least two services and an area</li>
              {ws?.places_key_hint ? <li>Google ratings for the client and competitors</li> : <li>Add a Google Places key in Settings to include Google ratings</li>}
            </ul>
          </Card>
          {start.error && <Note tone="bad">{(start.error as Error).message}</Note>}
          <Button variant="primary" className="h-10" onClick={() => start.mutate()} loading={start.isPending} disabled={!client || (!website.trim() && !pasted.trim()) || !!noKey}>
            Start research
          </Button>
          <p className="text-xs text-fg-3">Uses the research model set in Settings and up to 4 web searches. Counts toward your monthly cap.</p>
        </div>
      </div>
    </>
  )
}
