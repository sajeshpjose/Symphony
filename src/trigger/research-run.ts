// Research run (MVP step 3). Port of skills/client-intelligence-report as a long job.
// crawl the client site -> extract claims -> find and read competitors -> check every quote
// -> write the report and meeting questions -> validate every block -> save.
// Progress is written to research_runs so the app can show it while the run is going.
import { AbortTaskRunError, logger, metadata, schemaTask } from '@trigger.dev/sdk'
import { z } from 'zod'
import { claudeFor } from '../../netlify/functions/_shared/claude'
import { HttpError } from '../../netlify/functions/_shared/http'
import { adminClient } from '../../netlify/functions/_shared/supabase'
import {
  checkClaims,
  validateSections,
  wordCount,
  type Question,
  type ReportData,
  type ResearchClaim,
  type Section,
} from '../../packages/core/src/research'
import { toolCall, type CallCtx } from '../research/claude'
import { crawlSite, normalizeUrl, type Page } from '../research/crawl'
import { findPlace, type PlaceResult } from '../research/places'
import {
  CANDIDATES_SCHEMA,
  CLAIMS_INSTRUCTION,
  CLAIMS_SCHEMA,
  COMPETITOR_FACTS_INSTRUCTION,
  COMPETITOR_FACTS_SCHEMA,
  COMPETITOR_SEARCH_INSTRUCTION,
  RESEARCH_SYSTEM,
  WRITE_INSTRUCTION,
  WRITE_SCHEMA,
} from '../research/prompts'

const MAX_CLIENT_PAGES = 25
const MAX_COMPETITORS = 5
const PAGES_PER_COMPETITOR = 4
const CLIENT_PAGE_WORDS = 1800
const COMPETITOR_PAGE_WORDS = 1000
const MIN_SITE_WORDS = 100

type RunUpload = { kind: string; file: string; label: string; path?: string; text: string; flags?: { tracking_warning?: boolean; reviews_count?: number } }
type RunInputs = { competitors?: string[]; pasted_text?: string; uploads?: RunUpload[] }

type RawClaim = { section: string; text: string; quote: string; page_ref: string; evidence: ResearchClaim['evidence']; decision: 'included' | 'question'; note?: string; competitor?: string }

type RawClaimWithSource = RawClaim & { source_url?: string; source_title?: string }

type SavedPage = Page & { ref: string; kind: 'client' | 'competitor' | 'pasted' | 'upload'; competitor?: string }

const clip = (text: string, words: number) => {
  const w = text.split(/\s+/)
  return w.length <= words ? text : w.slice(0, words).join(' ') + ' …'
}

const pagesBlock = (pages: SavedPage[], words: number) =>
  pages.map((p) => `<page ref="${p.ref}" url="${p.url}" title="${p.title.replace(/"/g, "'")}">\n${clip(p.text, words)}\n</page>`).join('\n\n')

// Report text follows the house writing rules: no em or en dashes.
const undash = (t: string) => t.replace(/\s*[—]\s*/g, ', ').replace(/(\d)\s*–\s*(\d)/g, '$1 to $2').replace(/\s*–\s*/g, ', ')

function undashSections(sections: Section[]): Section[] {
  return sections.map((s) => ({
    ...s,
    blocks: s.blocks.map((b) => {
      switch (b.type) {
        case 'paragraph':
          return { ...b, text: undash(b.text) }
        case 'callout':
          return { ...b, text: undash(b.text), title: b.title && undash(b.title) }
        case 'bullets':
          return { ...b, items: b.items.map((i) => ({ ...i, text: undash(i.text ?? '') })) }
        case 'table':
          return { ...b, rows: b.rows.map((r) => r.map((c) => ({ ...c, text: undash(c.text ?? '') }))) }
        default:
          return b
      }
    }),
  }))
}

const STEP_LABELS: Record<string, string> = {
  start: 'starting',
  crawl: 'reading the website',
  claims: 'pulling out facts',
  competitors: 'competitors',
  reviews: 'Google ratings',
  verify: 'checking quotes',
  write: 'writing the report',
}

// The real cause of an error, for the run page and the Trigger.dev log.
function errorDetail(e: unknown): string {
  if (!e) return 'unknown error'
  const any = e as { message?: string; status?: number; error?: { error?: { message?: string } }; details?: string; code?: string }
  const api = any.error?.error?.message // Anthropic API error body
  const parts = [any.status ? `HTTP ${any.status}` : '', api ?? any.message ?? '', any.details ?? '', any.code ? `code ${any.code}` : ''].filter(Boolean)
  return (parts.join(' · ') || JSON.stringify(e)).slice(0, 600)
}

export const researchRun = schemaTask({
  id: 'research-run',
  schema: z.object({ runId: z.string().uuid() }),
  maxDuration: 3600,
  // A failed run is marked failed in the app and can be started again; no automatic re-runs (they cost money).
  retry: { maxAttempts: 1 },
  queue: { concurrencyLimit: 3 },
  run: async ({ runId }, { ctx: tctx }) => {
    const db = adminClient()
    const { data: run } = await db.from('research_runs').select('*').eq('id', runId).single()
    if (!run) throw new AbortTaskRunError('Run not found')
    const workspaceId: string = run.workspace_id
    const clientId: string = run.client_id
    const inputs = (run.inputs ?? {}) as RunInputs
    let cost = 0
    const warnings: string[] = []

    const update = async (fields: Record<string, unknown>) => {
      const { error } = await db.from('research_runs').update(fields).eq('id', runId)
      if (error) logger.warn('Could not update run', { error })
    }
    let currentStep = 'start'
    const progress = async (step: string, text: string) => {
      currentStep = step
      metadata.set('step', step).set('progress', text)
      await update({ step, progress: text })
    }

    await update({ status: 'running', started_at: new Date().toISOString(), trigger_run_id: tctx.run.id, error: null })

    try {
      const [{ data: client }, { data: ws }] = await Promise.all([
        db.from('clients').select('*').eq('id', clientId).single(),
        db.from('workspaces').select('models').eq('id', workspaceId).single(),
      ])
      if (!client) throw new AbortTaskRunError('Client not found')
      const model: string = (ws?.models as Record<string, string>)?.research ?? 'claude-sonnet-5-5'
      const website = normalizeUrl(run.website || client.website || '')

      // ---- 1. Crawl the client site --------------------------------------------------
      const pages: SavedPage[] = []
      const nextRef = () => `P${String(pages.length + 1).padStart(2, '0')}`
      const savePages = async (list: SavedPage[]) => {
        if (!list.length) return
        const { error } = await db.from('research_pages').insert(
          list.map((p) => ({ run_id: runId, workspace_id: workspaceId, ref: p.ref, url: p.url, title: p.title, kind: p.kind, competitor: p.competitor ?? null, words: p.words, text: p.text })),
        )
        if (error) throw error
      }

      if (website) {
        await progress('crawl', 'Reading the website')
        const crawl = await crawlSite(website, {
          maxPages: MAX_CLIENT_PAGES,
          onPage: (n) => progress('crawl', `Reading the website · ${n} page${n === 1 ? '' : 's'}`),
        })
        for (const p of crawl.pages) pages.push({ ...p, ref: nextRef(), kind: 'client' })
        for (const f of crawl.failed) warnings.push(`Could not read ${f.url} (${f.reason})`)
        if (crawl.blockedByRobots) warnings.push('The site asks robots not to read its homepage')
      }
      if (inputs.pasted_text?.trim()) {
        const text = inputs.pasted_text.trim()
        pages.push({ url: 'pasted://text', title: 'Text pasted by the agency', text, words: wordCount(text), ref: nextRef(), kind: 'pasted' })
      }
      // Uploaded exports: the browser already turned each file into a text copy of its figures.
      for (const u of inputs.uploads ?? []) {
        const text = `${u.label}\n${u.text}${u.flags?.tracking_warning ? '\ntracking warning true' : ''}`
        pages.push({ url: `file://${u.file}`, title: `${u.label}: ${u.file}`, text, words: wordCount(text), ref: nextRef(), kind: 'upload' })
      }
      await savePages(pages)

      const totalWords = pages.reduce((n, p) => n + p.words, 0)
      if (totalWords < MIN_SITE_WORDS) {
        await update({
          status: 'needs_input',
          step: 'crawl',
          progress: null,
          error: pages.length
            ? `The site gave us only ${totalWords} words to read. It may load its text with scripts or block readers. Paste the main page text, then run again.`
            : 'We could not read the website. Check the address, or paste the main page text and run again.',
          warnings,
          stats: { pages: pages.length },
          cost_usd: cost,
          finished_at: new Date().toISOString(),
        })
        return { status: 'needs_input' }
      }

      const claude = await claudeFor(workspaceId)
      const call: CallCtx = { claude, model, workspaceId, clientId, system: RESEARCH_SYSTEM, onCost: (c) => (cost += c) }

      // ---- 2. Claims from the client site ---------------------------------------------
      await progress('claims', `Pulling facts from ${pages.length} pages`)
      const notes = [
        client.industry && `Industry: ${client.industry}`,
        client.location && `Location given by the agency: ${client.location}`,
        client.sells && `What they sell (agency notes): ${client.sells}`,
        client.audience && `Audience (agency notes): ${client.audience}`,
      ]
        .filter(Boolean)
        .join('\n')
      const uploadNote = (inputs.uploads ?? []).length
        ? `\nUploaded exports: ${(inputs.uploads ?? []).map((u) => `${u.label} (${u.file})`).join(', ')}.`
        : ''
      const extracted = await toolCall<{ business_name: string; claims: RawClaim[]; services: string[]; area: string }>(call, {
        content: [
          { type: 'text', text: pagesBlock(pages, CLIENT_PAGE_WORDS) },
          { type: 'text', text: CLAIMS_INSTRUCTION({ name: client.name, url: website ?? 'no website', notes: notes + uploadNote }) },
        ],
        toolName: 'record_claims',
        schema: CLAIMS_SCHEMA,
        maxTokens: 16000,
      })
      const raw: RawClaim[] = [...(extracted.claims ?? [])]

      // ---- 3. Competitors ---------------------------------------------------------------
      const known = (inputs.competitors ?? []).map((s) => s.trim()).filter(Boolean)
      let competitorSummary = ''
      const qualified: { name: string; url: string }[] = []
      if (website || known.length) {
        try {
          await progress('competitors', 'Searching for competitors')
          const found = await toolCall<{ candidates: { name: string; url: string; named: boolean; why?: string }[] }>(call, {
            content: COMPETITOR_SEARCH_INSTRUCTION({ name: client.name, url: website ?? '', services: extracted.services ?? [], area: extracted.area ?? client.location ?? '', known }),
            toolName: 'competitor_candidates',
            schema: CANDIDATES_SCHEMA,
            maxTokens: 3000,
            webSearch: { maxUses: 4 },
          })
          const clientHost = website ? new URL(website).hostname.replace(/^www\./, '') : ''
          const candidates = (found.candidates ?? [])
            .map((c) => ({ ...c, url: normalizeUrl(c.url) }))
            .filter((c): c is typeof c & { url: string } => !!c.url && new URL(c.url).hostname.replace(/^www\./, '') !== clientHost)
            .slice(0, Math.max(MAX_COMPETITORS, known.length))

          const compPages: SavedPage[] = []
          const read: { name: string; named: boolean }[] = []
          for (const [i, c] of candidates.entries()) {
            await progress('competitors', `Reading competitor sites · ${i + 1} of ${candidates.length}`)
            const crawl = await crawlSite(c.url, { maxPages: PAGES_PER_COMPETITOR, maxDepth: 1 })
            if (!crawl.pages.length) {
              warnings.push(`Could not read competitor ${c.name} (${c.url})`)
              continue
            }
            read.push({ name: c.name, named: !!c.named })
            for (const p of crawl.pages) {
              const page: SavedPage = { ...p, ref: `P${String(pages.length + compPages.length + 1).padStart(2, '0')}`, kind: 'competitor', competitor: c.name }
              compPages.push(page)
            }
          }
          await savePages(compPages)
          pages.push(...compPages)

          if (read.length) {
            await progress('competitors', `Comparing ${read.length} competitor${read.length === 1 ? '' : 's'}`)
            const facts = await toolCall<{
              competitors: { name: string; overlapping_services: string[]; area: string; qualifies: boolean; reason?: string }[]
              claims: RawClaim[]
            }>(call, {
              content: [
                { type: 'text', text: pagesBlock(compPages, COMPETITOR_PAGE_WORDS) },
                { type: 'text', text: COMPETITOR_FACTS_INSTRUCTION({ name: client.name, services: extracted.services ?? [], area: extracted.area ?? '', competitors: read }) },
              ],
              toolName: 'competitor_facts',
              schema: COMPETITOR_FACTS_SCHEMA,
              maxTokens: 8000,
            })
            // A competitor goes in the report only if it was named or passes both tests (decision D22).
            const qualifies = new Map(
              (facts.competitors ?? []).map((c) => [
                c.name.toLowerCase(),
                read.find((r) => r.name.toLowerCase() === c.name.toLowerCase())?.named || (c.qualifies && c.overlapping_services.length >= 2 && !!c.area),
              ]),
            )
            for (const c of facts.claims ?? []) {
              const ok = qualifies.get((c.competitor ?? '').toLowerCase())
              raw.push({ ...c, section: 'competitors', evidence: 'stated', decision: ok ? c.decision : 'question' })
            }
            for (const c of candidates) if (qualifies.get(c.name.toLowerCase())) qualified.push({ name: c.name, url: c.url })
            competitorSummary = (facts.competitors ?? [])
              .map((c) => `${c.name}: ${qualifies.get(c.name.toLowerCase()) ? 'qualifies' : 'does not qualify'}. Overlapping services: ${c.overlapping_services.join(', ') || 'none'}. Area: ${c.area || 'not stated'}.${c.reason ? ` ${c.reason}` : ''}`)
              .join('\n')
          }
        } catch (e) {
          // A failed search or comparison should not cost the whole run.
          if (e instanceof HttpError) throw e // monthly cap reached
          logger.warn('Competitor step failed', { error: errorDetail(e) })
          warnings.push(`Competitors skipped: ${errorDetail(e)}`)
        }
      }

      // ---- 4. Google ratings (optional, needs a Places key) --------------------------------
      const places: { claims: RawClaimWithSource[]; sample: string } = { claims: [], sample: '' }
      const { data: placesKey } = await db.rpc('get_places_key', { ws: workspaceId })
      if (placesKey) {
        await progress('reviews', 'Looking up Google ratings')
        const today = new Date().toISOString().slice(0, 10)
        const area = extracted.area || client.location || ''
        const targets = [{ name: client.name, url: website, competitor: undefined as string | undefined }, ...qualified.map((q) => ({ name: q.name, url: q.url, competitor: q.name }))]
        for (const t of targets) {
          let place: PlaceResult | null = null
          try {
            place = await findPlace(placesKey as string, `${t.name} ${area}`.trim(), t.url)
          } catch (e) {
            warnings.push(`Google ratings lookup failed for ${t.name}: ${(e as Error).message}`)
            continue
          }
          if (!place || place.rating === null) {
            if (!t.competitor) warnings.push(`No Google profile with ratings found for ${t.name}`)
            continue
          }
          const who = t.competitor ?? client.name
          places.claims.push({
            section: 'reviews',
            text: `${who} has a Google rating of ${place.rating} from ${place.count} reviews (retrieved ${today}).`,
            quote: '',
            page_ref: '',
            evidence: 'stated',
            // A profile whose website does not match could be another business with the same name.
            decision: place.matched ? 'included' : 'question',
            note: `Google Business Profile ${place.name}, ${place.address}. Rating ${place.rating}, ${place.count} reviews.${place.matched ? '' : ' The profile website does not match the site researched; confirm it is theirs.'}`,
            competitor: t.competitor,
            source_url: `google-business-profile://${place.id}`,
            source_title: `Google Business Profile, retrieved ${today}`,
          })
          if (place.reviews.length)
            places.sample += `${who} (${place.reviews.length} most relevant Google reviews, a sample only):\n${place.reviews.map((r) => `- ${r.rating} stars: ${r.text.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n')}\n`
        }
      }

      // ---- 5. Check every quote against the saved pages -----------------------------------
      await progress('verify', 'Checking every quote against the pages')
      const allRaw: RawClaimWithSource[] = [...raw, ...places.claims]
      const numbered: ResearchClaim[] = allRaw.map((c, i) => ({
        id: `C${String(i + 1).padStart(3, '0')}`,
        section: c.section,
        text: c.text,
        quote: c.evidence === 'observed_absence' ? '' : c.quote ?? '',
        page_ref: c.evidence === 'observed_absence' ? '' : c.page_ref ?? '',
        source_url: c.source_url ?? '',
        source_title: c.source_title ?? pages.find((p) => p.ref === c.page_ref)?.title,
        evidence: c.evidence,
        status: c.decision === 'included' ? 'included' : 'question',
        note: c.note,
        competitor: c.competitor,
      }))
      const checked = checkClaims(numbered, new Map(pages.map((p) => [p.ref, { url: p.url, text: p.text }])))
      const claims = checked.claims
      warnings.push(...checked.warnings)

      // ---- 6. Write the report and questions ----------------------------------------------
      await progress('write', 'Writing the report and meeting questions')
      const forWriter = claims
        .filter((c) => c.status !== 'dropped')
        .map((c) => ({ id: c.id, section: c.section, text: c.text, quote: c.quote, evidence: c.evidence, status: c.status, competitor: c.competitor, note: c.note }))
      const written = await toolCall<{ sections: Section[]; questions: Omit<Question, 'id'>[] }>(call, {
        content: WRITE_INSTRUCTION({ name: client.name, claimsJson: JSON.stringify(forWriter), competitorSummary, reviewSample: places.sample }),
        toolName: 'write_report',
        schema: WRITE_SCHEMA,
        maxTokens: 16000,
      })

      const valid = validateSections(undashSections(written.sections ?? []), claims)
      warnings.push(...valid.warnings)
      const questions: Question[] = (written.questions ?? []).map((q, i) => ({ ...q, id: `Q${String(i + 1).padStart(2, '0')}` }))

      const report: ReportData = {
        version: 'v1',
        date: new Date().toISOString().slice(0, 10),
        client: { name: client.name, url: website ?? '', location: client.location ?? undefined, industry: client.industry ?? undefined },
        sections: valid.sections,
      }

      const stats = {
        pages: pages.filter((p) => p.kind === 'client' || p.kind === 'pasted').length,
        uploads: pages.filter((p) => p.kind === 'upload').length,
        google_profiles: places.claims.length,
        competitor_pages: pages.filter((p) => p.kind === 'competitor').length,
        claims: claims.length,
        included: claims.filter((c) => c.status === 'included').length,
        questions: questions.length,
        dropped: claims.filter((c) => c.status === 'dropped').length,
        sections: valid.sections.length,
      }
      await update({
        status: 'ready',
        step: 'done',
        progress: null,
        report,
        claims,
        questions,
        warnings,
        stats,
        cost_usd: Number(cost.toFixed(4)),
        finished_at: new Date().toISOString(),
      })
      logger.info('Research run ready', stats)
      return { status: 'ready', ...stats, cost }
    } catch (e) {
      const detail = errorDetail(e)
      const friendly =
        e instanceof HttpError || e instanceof AbortTaskRunError
          ? e.message
          : (e as { status?: number }).status === 401
            ? 'Claude rejected the API key. Check it in Settings.'
            : (e as { status?: number }).status === 429
              ? 'Claude is busy or the rate limit was reached. Try again in a few minutes.'
              : 'The run stopped with an error.'
      const stepLabel = STEP_LABELS[currentStep] ?? currentStep
      const message = (friendly === detail ? `${friendly} (step: ${stepLabel})` : `${friendly} Step: ${stepLabel}. Details: ${detail}`).slice(0, 1000)
      logger.error('Research run failed', { step: currentStep, error: detail })
      await update({ status: 'failed', progress: null, error: message, warnings, cost_usd: Number(cost.toFixed(4)), finished_at: new Date().toISOString() })
      throw new AbortTaskRunError(message)
    }
  },
})
