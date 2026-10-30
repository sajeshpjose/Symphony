// Research report data and the evidence checks, ported from
// skills/client-intelligence-report (references/data-schema.md, scripts/build_outputs.py).
// The report shows only blocks that pass these checks; everything else becomes a warning.

export type Evidence = 'stated' | 'corroborated' | 'client_confirmed' | 'observed_absence' | 'inferred' | 'single_external'
export type ClaimDecision = 'included' | 'question' | 'dropped'

export const ALLOWED_EVIDENCE: Evidence[] = ['stated', 'corroborated', 'client_confirmed', 'observed_absence']

export type ResearchClaim = {
  id: string // C001
  section: string
  text: string
  quote: string // under 15 words, exact from the page; empty for observed_absence
  page_ref: string // P01; empty for observed_absence
  source_url: string
  source_title?: string
  evidence: Evidence
  status: ClaimDecision
  note?: string
  competitor?: string // set for competitor facts
  verified?: boolean // quote found in the saved page
}

export type Cited = { text: string; claim_ids: string[]; structural?: boolean }
export type FactItem = { label: string; value: string; claim_ids: string[] }

export type Block =
  | { type: 'paragraph'; text: string; claim_ids: string[]; structural?: boolean; lead?: boolean }
  | { type: 'callout'; title?: string; text: string; claim_ids: string[]; structural?: boolean }
  | { type: 'bullets'; items: Cited[] }
  | { type: 'table'; headers: string[]; rows: Cited[][] }
  | { type: 'facts'; items: FactItem[] }

export type Section = { key: string; title: string; blocks: Block[] }

export type Question = {
  id: string
  topic: string
  question: string
  trigger: string
  site_says: string
  priority: 'must' | 'nice'
  claim_ids?: string[]
}

export type ReportData = {
  version: 'v1'
  date: string
  client: { name: string; url: string; location?: string; industry?: string }
  sections: Section[]
}

export const SECTION_ORDER = [
  'summary', 'overview', 'offerings', 'aspirations', 'audiences', 'customers', 'reviews', 'search', 'analytics',
  'ads', 'social', 'competitors',
  'standout', 'opportunities', 'actions', 'content', 'market',
] as const

export const SECTION_TITLES: Record<string, string> = {
  summary: 'Executive summary',
  overview: 'Business overview',
  offerings: 'Services and offerings',
  aspirations: 'Stated aspirations and positioning',
  audiences: 'Audiences the business addresses',
  customers: 'What customers say',
  reviews: 'Reputation',
  search: 'Search demand',
  analytics: 'Website performance',
  ads: 'Paid media',
  social: 'Social presence',
  competitors: 'Competitive landscape',
  standout: 'Where the business stands out today',
  opportunities: 'Opportunities',
  actions: 'Action points',
  content: 'Content starter themes',
  market: 'Market context',
}

export const QUESTION_TOPICS = [
  'Goals and priorities',
  'Customers and decision makers',
  'Offerings and pricing',
  'Competitors they lose to',
  'Brand and voice',
  'Marketing and measurement',
  'Constraints and topics to avoid',
]

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function normText(t: string | null | undefined): string {
  return (t ?? '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9'"$%.-]+/g, ' ')
    .trim()
}

export const wordCount = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

const NUM_RE = /(?<![A-Za-z\d])\d[\d,]*(?:\.\d+)?(?![A-Za-z])/g
const NUMBER_WORDS: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
}

// Digits in a text. With words=true also number words, so "six services" in a claim allows a "6" in the report.
export function numbersIn(text: string | null | undefined, words = false): Set<string> {
  const found = new Set<string>()
  for (const m of (text ?? '').match(NUM_RE) ?? []) found.add(m.replace(/[,\s]/g, '').replace(/\.$/, ''))
  if (words) {
    const lower = (text ?? '').toLowerCase()
    for (const [w, d] of Object.entries(NUMBER_WORDS)) if (new RegExp(`\\b${w}\\b`).test(lower)) found.add(d)
  }
  return found
}

// A quote is verified when its normalised text appears in the normalised page text.
export function quoteFound(quote: string, pageText: string): boolean {
  const q = normText(quote)
  return q.length > 0 && normText(pageText).includes(q)
}

// ---------------------------------------------------------------------------
// Claim checks (run after Claude extracts claims, before the report is written)
// ---------------------------------------------------------------------------

export function checkClaims(claims: ResearchClaim[], pages: Map<string, { url: string; text: string }>): { claims: ResearchClaim[]; warnings: string[] } {
  const warnings: string[] = []
  const out = claims.map((c) => {
    const claim = { ...c }
    if (!ALLOWED_EVIDENCE.includes(claim.evidence) && claim.status === 'included') {
      claim.status = 'question'
      claim.note = [claim.note, `Evidence "${claim.evidence}" cannot go in the report`].filter(Boolean).join('. ')
    }
    // Google ratings come from the Places API, not a page; the lookup is recorded in the note.
    if (claim.evidence === 'observed_absence' || claim.source_url.startsWith('google-business-profile://')) {
      claim.verified = true
      return claim
    }
    if (wordCount(claim.quote) >= 15) {
      claim.verified = false
      if (claim.status === 'included') claim.status = 'dropped'
      warnings.push(`${claim.id}: quote is 15 words or more`)
      return claim
    }
    const page = pages.get(claim.page_ref)
    if (page) claim.source_url = page.url
    claim.verified = !!page && quoteFound(claim.quote, page.text)
    if (!claim.verified && claim.status === 'included') {
      claim.status = 'dropped'
      claim.note = [claim.note, 'Quote not found on the saved page'].filter(Boolean).join('. ')
      warnings.push(`${claim.id}: quote not found on ${page?.url ?? claim.page_ref}`)
    }
    return claim
  })
  return { claims: out, warnings }
}

// ---------------------------------------------------------------------------
// Block checks (port of check_refs / validate_sections). Failing blocks are removed, not fatal.
// ---------------------------------------------------------------------------

function refProblem(ids: string[], idx: Map<string, ResearchClaim>, text: string, structural?: boolean): string | null {
  const hedge = hedgeIn(text)
  if (hedge) return `uses "${hedge}"`
  if (!ids?.length) {
    if (!structural) return 'no claims cited'
    if (/\d/.test(text)) return 'structural text has numbers'
    return null
  }
  const allowed = new Set<string>()
  for (const id of ids) {
    const c = idx.get(id)
    if (!c) return `unknown claim ${id}`
    if (c.status !== 'included') return `claim ${id} is not included`
    if (!ALLOWED_EVIDENCE.includes(c.evidence)) return `claim ${id} has evidence ${c.evidence}`
    for (const n of numbersIn(c.text, true)) allowed.add(n)
    for (const n of numbersIn(c.quote, true)) allowed.add(n)
  }
  const missing = [...numbersIn(text)].filter((n) => !allowed.has(n))
  if (missing.length) return `numbers ${missing.join(', ')} are not in the cited claims`
  return null
}

const blockIds = (b: Block): string[] => {
  switch (b.type) {
    case 'paragraph':
    case 'callout':
      return b.claim_ids ?? []
    case 'bullets':
      return b.items.flatMap((i) => i.claim_ids ?? [])
    case 'facts':
      return b.items.flatMap((i) => i.claim_ids ?? [])
    case 'table':
      return b.rows.flatMap((r) => r.flatMap((c) => c.claim_ids ?? []))
  }
}

export function validateSections(sections: Section[], claims: ResearchClaim[]): { sections: Section[]; warnings: string[] } {
  const idx = new Map(claims.map((c) => [c.id, c]))
  const warnings: string[] = []
  const kept: Section[] = []
  for (const s of sections) {
    const blocks: Block[] = []
    s.blocks.forEach((b, i) => {
      const where = `${SECTION_TITLES[s.key] ?? s.key}, block ${i + 1}`
      let problem: string | null = null
      let block: Block | null = b
      switch (b.type) {
        case 'paragraph':
          problem = refProblem(b.claim_ids, idx, b.text, b.structural)
          break
        case 'callout':
          problem = refProblem(b.claim_ids, idx, `${b.title ?? ''} ${b.text}`, b.structural)
          break
        case 'bullets': {
          // Drop failing items, keep the rest.
          const items = b.items.filter((it, j) => {
            const p = refProblem(it.claim_ids, idx, it.text, it.structural)
            if (p) warnings.push(`${where}, item ${j + 1}: ${p}`)
            return !p
          })
          block = items.length ? { ...b, items } : null
          if (!items.length) problem = 'no items passed'
          break
        }
        case 'facts': {
          const items = b.items.filter((it, j) => {
            const p = refProblem(it.claim_ids, idx, `${it.label} ${it.value}`)
            if (p) warnings.push(`${where}, fact ${j + 1}: ${p}`)
            return !p
          })
          block = items.length >= 2 ? { ...b, items } : null
          if (items.length < 2) problem = 'fewer than two facts passed'
          break
        }
        case 'table': {
          // A row is kept only if every cell passes.
          const rows = b.rows.filter((row, r) => {
            for (const cell of row) {
              const p = typeof cell === 'string' ? 'cell has no claims' : refProblem(cell.claim_ids, idx, cell.text, cell.structural)
              if (p) {
                warnings.push(`${where}, row ${r + 1}: ${p}`)
                return false
              }
            }
            return true
          })
          block = rows.length ? { ...b, rows } : null
          if (!rows.length) problem = 'no rows passed'
          break
        }
        default:
          problem = 'unknown block type'
      }
      if (!problem && block && (s.key === 'opportunities' || s.key === 'standout' || s.key === 'actions')) {
        const ids = blockIds(block)
        if (ids.length && ids.every((id) => idx.get(id)?.evidence === 'observed_absence')) {
          problem = 'rests on an observed absence alone'
        }
      }
      if (problem || !block) {
        if (problem) warnings.push(`${where}: ${problem}`)
        return
      }
      blocks.push(block)
    })
    if (blocks.length) kept.push({ ...s, title: s.title || SECTION_TITLES[s.key] || s.key, blocks })
  }
  const order = (k: string) => {
    const i = (SECTION_ORDER as readonly string[]).indexOf(k)
    return i < 0 ? 99 : i
  }
  kept.sort((a, b) => order(a.key) - order(b.key))
  return { sections: kept, warnings }
}

// Hedging is never allowed in report text (qa_check.py). "may" is matched in lower case only so the month passes.
export const HEDGE_WORDS = ['likely', 'probably', 'appears to', 'seems', 'perhaps', 'possibly', 'needs validation']

export function hedgeIn(text: string): string | null {
  if (/\b(may|might)\b/.test(text)) return text.match(/\b(may|might)\b/)![1]
  return HEDGE_WORDS.find((w) => new RegExp(`\\b${w}\\b`, 'i').test(text)) ?? null
}
