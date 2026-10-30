// POST /api/research-start  { clientId, website?, competitors?: string[], pastedText?, uploads?: Upload[] }
// Uploads are parsed in the browser (packages/core/src/importers.ts); the original file is already in Storage.
// Creates a research run and hands it to the Trigger.dev "research-run" task.
import type { Config } from '@netlify/functions'
import { tasks } from '@trigger.dev/sdk'
import { z } from 'zod'
import type { researchRun } from '../../src/trigger/research-run'
import { assertUnderCap, claudeFor } from './_shared/claude'
import { handle, HttpError, json } from './_shared/http'
import { adminClient, requireUser } from './_shared/supabase'

const Body = z.object({
  clientId: z.string().uuid(),
  website: z.string().trim().max(300).optional(),
  competitors: z.array(z.string().trim().max(200)).max(8).optional(),
  pastedText: z.string().max(60_000).optional(),
  uploads: z
    .array(
      z.object({
        kind: z.enum(['ga4', 'gsc_queries', 'gsc_pages', 'meta_ads', 'reviews', 'social']),
        file: z.string().max(200),
        label: z.string().max(80),
        path: z.string().max(400).optional(),
        text: z.string().max(150_000),
        flags: z.object({ tracking_warning: z.boolean().optional(), reviews_count: z.number().optional() }).optional(),
      }),
    )
    .max(8)
    .optional(),
})

export default handle(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST')
  const { workspaceId } = await requireUser(req)
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) throw new HttpError(400, 'Check the form and try again')
  const body = parsed.data
  const db = adminClient()

  const { data: client } = await db.from('clients').select('id, website').eq('id', body.clientId).eq('workspace_id', workspaceId).maybeSingle()
  if (!client) throw new HttpError(404, 'Client not found')
  const website = body.website || client.website
  if (!website && !body.pastedText?.trim()) throw new HttpError(400, 'Add a website or paste the page text')
  // Uploaded files must sit in this client's folder.
  if (body.uploads?.some((u) => u.path && !u.path.startsWith(`${workspaceId}/${client.id}/`))) throw new HttpError(400, 'Upload path does not belong to this client')

  await claudeFor(workspaceId) // fails early if no key is saved
  await assertUnderCap(workspaceId)
  if (!process.env.TRIGGER_SECRET_KEY) throw new HttpError(500, 'Server is missing TRIGGER_SECRET_KEY')

  const { data: active } = await db.from('research_runs').select('id').eq('client_id', client.id).in('status', ['queued', 'running']).limit(1)
  if (active?.length) throw new HttpError(409, 'A research run is already going for this client')

  const { data: run, error } = await db
    .from('research_runs')
    .insert({
      client_id: client.id,
      workspace_id: workspaceId,
      website,
      inputs: { competitors: body.competitors ?? [], pasted_text: body.pastedText?.trim() || undefined, uploads: body.uploads ?? [] },
      progress: 'Waiting to start',
    })
    .select('id')
    .single()
  if (error) throw error

  try {
    const handleRun = await tasks.trigger<typeof researchRun>('research-run', { runId: run.id }, { tags: [`client:${client.id}`] })
    await db.from('research_runs').update({ trigger_run_id: handleRun.id }).eq('id', run.id)
  } catch (e) {
    console.error(e)
    await db.from('research_runs').update({ status: 'failed', error: 'Could not start the background job. Is the Trigger.dev worker running?' }).eq('id', run.id)
    throw new HttpError(502, 'Could not start the research run. Check that Trigger.dev is running.')
  }
  return json({ runId: run.id })
})

export const config: Config = { path: '/api/research-start' }
