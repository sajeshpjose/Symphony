// Research uploads: TypeScript ports of skills/client-intelligence-report/scripts/import_*.py.
// Each importer turns an export into (1) a short summary for the upload preview and (2) a plain-text
// copy of the figures. The text copy is saved as a research page under file://<name>, so claims
// quote figures from it and the normal quote check covers them (references/analytics-inputs.md).
// Pure functions: the browser reads the file and passes rows or text in.

export type UploadKind = 'ga4' | 'gsc_queries' | 'gsc_pages' | 'meta_ads' | 'reviews' | 'social'

export type Imported = {
  kind: UploadKind
  file: string
  label: string // "GA4 overview", shown in the app
  summary: string[] // a few lines for the preview
  text: string // text copy for claims and quote checks
  flags?: { tracking_warning?: boolean; reviews_count?: number }
}

export const UPLOAD_LABELS: Record<UploadKind, string> = {
  ga4: 'GA4 overview',
  gsc_queries: 'Search Console queries',
  gsc_pages: 'Search Console pages',
  meta_ads: 'Meta Ads report',
  reviews: 'Reviews export',
  social: 'Social snapshot',
}

// --- small helpers -------------------------------------------------------------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[%,$\s]/g, ''))
  return Number.isFinite(n) ? n : NaN
}
const n0 = (v: unknown) => (Number.isFinite(toNum(v)) ? toNum(v) : 0)
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(round(v, 2)))
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const isBrand = (q: string, brand: string[]) => brand.some((b) => b && q.toLowerCase().includes(b))

// Brand terms for "branded share": the client's name and its first word, lower case.
export function brandTerms(clientName: string): string[] {
  const name = clientName.toLowerCase().replace(/\b(inc|ltd|llc|corp|corporation|co|company)\b\.?/g, '').trim()
  const first = name.split(/[\s&,.-]+/).filter((w) => w.length > 2)[0]
  return [...new Set([name, first].filter(Boolean) as string[])]
}

// --- 1. GA4 overview CSV (import_ga4_overview.py) -----------------------------------

export function importGa4Overview(file: string, raw: string, brand: string[]): Imported {
  const meta: Record<string, string> = { account: '', property: '', start: '', end: '' }
  const secs: { header: string; rows: string[] }[] = []
  let cur: { header: string; rows: string[] } | null = null
  for (const line of raw.replace(/\r/g, '').replace(/^﻿/, '').split('\n')) {
    if (line.startsWith('#')) {
      const m = line.match(/#\s*(Account|Property|Start date|End date):\s*(.*)/)
      if (m) {
        const k = m[1].toLowerCase().replace(' date', '')
        meta[k] = meta[k] || m[2].trim()
      }
      continue
    }
    if (!line.trim()) {
      cur = null
      continue
    }
    if (!cur) secs.push((cur = { header: line, rows: [] }))
    else cur.rows.push(line)
  }
  const pairs = (rows: string[]) =>
    rows.flatMap((r) => {
      const i = r.lastIndexOf(',')
      const v = Number(r.slice(i + 1))
      return i > 0 && Number.isFinite(v) ? [[r.slice(0, i).replace(/^"|"$/g, ''), v] as [string, number]] : []
    })

  const f: Record<string, unknown> = { source_file: file, property: meta.property, start: meta.start, end: meta.end }
  let newByWeek: [number, number][] = []
  let retByWeek: [number, number][] = []
  let cohorts: [string, number[]][] = []
  const lists: Record<string, [string, number][]> = {}
  const maps: Record<string, [string, number][]> = {}
  for (const s of secs) {
    const h = s.header
    const p = pairs(s.rows)
    if (h.startsWith('Nth week,New users')) {
      newByWeek = p.map(([k, v]) => [Number(k), v])
      f.new_users = sum(p.map((x) => x[1]))
    } else if (h.startsWith('Nth week,Returning users')) {
      retByWeek = p.map(([k, v]) => [Number(k), v])
      f.returning_users = sum(p.map((x) => x[1]))
    } else if (h.startsWith('Date,Week')) {
      cohorts = s.rows.map((r) => {
        const [d, ...w] = r.split(',')
        return [d, w.map(Number)]
      })
    } else if (h.includes('Qualified leads')) f.qualified_leads = sum(p.map((x) => x[1]))
    else if (h.includes('Converted leads')) f.converted_leads = sum(p.map((x) => x[1]))
    else if (h.startsWith('Platform,Key events')) f.key_events_rows = p.length
    else if (h.startsWith('First user primary channel group')) maps.new_users_by_channel = p
    else if (h.startsWith('Audience name')) f.active_users = Math.max(0, ...p.map((x) => x[1]))
    else if (h.startsWith('City,')) {
      f.cities = p.length
      maps.city_users = p
    } else if (h.startsWith('Landing page')) {
      const tot = sum(p.map((x) => x[1]))
      const blog = sum(p.filter(([k]) => k.startsWith('/blog')).map((x) => x[1]))
      f.landing_pages = p.length
      f.impressions_total = tot
      f.impressions_blog_share_pct = tot ? round((blog / tot) * 100) : null
      lists.top_landing_pages = p.slice(0, 15)
      lists.top_service_pages = p.filter(([k]) => !k.startsWith('/blog')).slice(0, 12)
    } else if (h.startsWith('Organic Google Search query')) {
      const tot = sum(p.map((x) => x[1]))
      const br = sum(p.filter(([k]) => isBrand(k, brand)).map((x) => x[1]))
      f.queries = p.length
      f.clicks_total = tot
      f.branded_clicks = br
      f.branded_share_pct = tot ? round((br / tot) * 100) : null
      lists.top_queries = p.slice(0, 25)
      lists.top_nonbrand_queries = p.filter(([k]) => !isBrand(k, brand)).slice(0, 15)
    } else if (h.startsWith('Session manual source')) maps.sessions_by_source = p
  }

  const lines = [`GA4 export ${file} for property ${meta.property}, start date ${meta.start}, end date ${meta.end}.`]
  let weekLabels: string[] = []
  if (newByWeek.length && /^\d{8}$/.test(meta.start)) {
    const sd = new Date(Date.UTC(+meta.start.slice(0, 4), +meta.start.slice(4, 6) - 1, +meta.start.slice(6, 8)))
    weekLabels = newByWeek.map(([n]) => {
      const d = new Date(sd.getTime() + 7 * (n - 1) * 86400000)
      return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`
    })
    // Weeks with no data are missing from the export, so label by position, not by week number.
    const peakIdx = newByWeek.reduce((best, w, i) => (w[1] > newByWeek[best][1] ? i : best), 0)
    f.peak_week_new_users = newByWeek[peakIdx][1]
    f.peak_week_label = weekLabels[peakIdx]
    f.min_week_new_users = Math.min(...newByWeek.map((x) => x[1]))
    lines.push('new users by week: ' + newByWeek.map(([, v], i) => `${weekLabels[i]} ${fmt(v)}`).join('; '))
    lines.push('returning users by week: ' + retByWeek.map(([, v], i) => `${weekLabels[i] ?? i + 1} ${fmt(v)}`).join('; '))
  }
  if (cohorts.length) {
    const wk1 = cohorts.filter(([, w]) => w.length > 1 && w[1] >= 0)
    f.week1_returning_total = sum(wk1.map(([, w]) => w[1]))
    f.week0_total_for_week1 = sum(wk1.map(([, w]) => w[0]))
    lines.push('retention cohorts (week 0, week 1, week 2...): ' + cohorts.map(([c, w]) => `${c}: ${w.join(', ')}`).join('; '))
  }
  const tracking = typeof f.clicks_total === 'number' && typeof f.active_users === 'number' ? (f.clicks_total as number) > 3 * Math.max(f.active_users as number, 1) : false
  f.tracking_warning = tracking
  for (const [k, v] of Object.entries(lists)) lines.push(`${k.replace(/_/g, ' ')}: ${v.map(([a, b]) => `${a} ${fmt(b)}`).join('; ')}`)
  for (const [k, v] of Object.entries(maps)) lines.push(`${k.replace(/_/g, ' ')}: ${v.map(([a, b]) => `${a} ${fmt(b)}`).join('; ')}`)
  for (const [k, v] of Object.entries(f)) lines.push(`${k.replace(/_/g, ' ')} ${typeof v === 'number' ? fmt(v) : v}`)

  const summary = [
    meta.start && `${meta.start} to ${meta.end}`,
    f.active_users !== undefined && `${fmt(f.active_users as number)} active users`,
    f.clicks_total !== undefined && `${fmt(f.clicks_total as number)} Google clicks`,
    tracking && 'Tracking looks broken: Google clicks are more than 3 times GA4 users',
  ].filter(Boolean) as string[]
  return { kind: 'ga4', file, label: UPLOAD_LABELS.ga4, summary, text: lines.join('\n'), flags: { tracking_warning: tracking } }
}

// --- 2. Search Console exports (import_gsc.py) ------------------------------------------

function table(rows: string[][]) {
  const header = rows[0].map((c) => c.trim().toLowerCase())
  return { header, body: rows.slice(1).filter((r) => r.some((c) => String(c).trim())) }
}

export function importGsc(file: string, rows: string[][], brand: string[]): Imported {
  const { header, body } = table(rows)
  const isQueries = header.some((h) => h.includes('quer'))
  const keyCol = header.findIndex((h) => (isQueries ? h.includes('quer') : h.includes('page')))
  const col = (name: string) => header.indexOf(name)
  const [ci, ii, pi] = [col('clicks'), col('impressions'), col('position')]
  const data = body.map((r) => ({ key: r[keyCol], clicks: n0(r[ci]), impressions: n0(r[ii]), position: pi >= 0 ? n0(r[pi]) : NaN }))
  const totC = sum(data.map((d) => d.clicks))
  const totI = sum(data.map((d) => d.impressions))
  const lines: string[] = [`Search Console export ${file}.`]
  const summary: string[] = []
  if (isQueries) {
    const branded = data.filter((d) => isBrand(d.key, brand))
    const brC = sum(branded.map((d) => d.clicks))
    const share = totC ? round((brC / totC) * 100) : null
    const nonbrand = data.filter((d) => !isBrand(d.key, brand)).sort((a, b) => b.clicks - a.clicks).slice(0, 20)
    lines.push(`queries ${data.length} clicks total ${fmt(totC)} impressions total ${fmt(totI)} branded clicks ${fmt(brC)} branded share pct ${share}`)
    lines.push('top nonbrand queries: ' + nonbrand.map((d) => `${d.key} ${fmt(d.clicks)} ${fmt(d.impressions)}${Number.isFinite(d.position) ? ` ${fmt(round(d.position, 2))}` : ''}`).join('; '))
    if (pi >= 0) {
      const imps = data.map((d) => d.impressions).sort((a, b) => a - b)
      const p80 = imps[Math.floor(0.8 * (imps.length - 1))] ?? 0
      const near = data
        .filter((d) => !isBrand(d.key, brand) && d.position >= 4 && d.position <= 15 && d.impressions >= p80)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 15)
      lines.push('page one or two opportunities: ' + near.map((d) => `${d.key} ${fmt(d.impressions)} ${fmt(d.clicks)} ${fmt(round(d.position, 2))}`).join('; '))
    }
    summary.push(`${data.length} queries`, `${fmt(totC)} clicks`, share !== null ? `${share}% branded` : '')
  } else {
    const blog = data.filter((d) => d.key.includes('/blog'))
    const share = totC ? round((sum(blog.map((d) => d.clicks)) / totC) * 100) : null
    const top = [...data].sort((a, b) => b.clicks - a.clicks).slice(0, 15)
    lines.push(`pages ${data.length} clicks total ${fmt(totC)} impressions total ${fmt(totI)} blog share of clicks pct ${share}`)
    lines.push('top pages: ' + top.map((d) => `${d.key} ${fmt(d.clicks)} ${fmt(d.impressions)}`).join('; '))
    summary.push(`${data.length} pages`, `${fmt(totC)} clicks`)
  }
  const kind = isQueries ? 'gsc_queries' : 'gsc_pages'
  return { kind, file, label: UPLOAD_LABELS[kind], summary: summary.filter(Boolean), text: lines.join('\n') }
}

// --- 3. Meta Ads Manager export (import_meta_ads.py) --------------------------------------

export function importMetaAds(file: string, raw: unknown[][]): Imported {
  const rows = raw.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c == null ? '' : String(c))))
  const hdr = rows.findIndex((r) => r.includes('Campaign name'))
  if (hdr < 0) throw new Error('No "Campaign name" column found. Export the campaign report from Ads Manager.')
  const header = rows[hdr]
  const body = rows.slice(hdr + 1).filter((r) => r.some((c) => c.trim()))
  const get = (r: string[], name: string) => r[header.indexOf(name)] ?? ''
  const spendCol = header.find((h) => h.startsWith('Amount spent')) ?? ''
  const cur = spendCol.includes('(') ? spendCol.split('(').pop()!.replace(')', '') : ''
  const level = (r: string[]) => get(r, 'Delivery level').toLowerCase()
  const period = header.includes('Reporting starts') && body[0] ? `${get(body[0], 'Reporting starts').slice(0, 10)} to ${get(body[0], 'Reporting ends').slice(0, 10)}` : ''
  const row = (r: string[]) => {
    const cpr = toNum(get(r, 'Cost per result'))
    return {
      reach: n0(get(r, 'Reach')),
      impressions: n0(get(r, 'Impressions')),
      frequency: round(n0(get(r, 'Frequency')), 2),
      results: n0(get(r, 'Results')),
      spend: round(n0(get(r, spendCol)), 2),
      cpr: Number.isFinite(cpr) ? round(cpr, 2) : null,
    }
  }
  const camps = body.filter((r) => level(r) === 'campaign')
  const sets = body.filter((r) => level(r) === 'adset')
  const totSpend = round(sum(camps.map((r) => row(r).spend)), 2)
  const totResults = sum(camps.map((r) => row(r).results))
  const lines = [`Meta Ads export ${file} period ${period} currency ${cur}`, `total spend ${fmt(totSpend)} total results ${fmt(totResults)}`]
  for (const r of camps) {
    const x = row(r)
    lines.push(`campaign ${get(r, 'Campaign name')}: status ${get(r, 'Delivery status')}; reach ${fmt(x.reach)}; impressions ${fmt(x.impressions)}; frequency ${fmt(x.frequency)}; result type ${get(r, 'Result type')}; results ${fmt(x.results)}; spend ${fmt(x.spend)}; cost per result ${x.cpr ?? 'None'}`)
  }
  for (const r of sets) {
    const x = row(r)
    lines.push(`ad set ${get(r, 'Ad set name')}: reach ${fmt(x.reach)}; impressions ${fmt(x.impressions)}; frequency ${fmt(x.frequency)}; results ${fmt(x.results)}; spend ${fmt(x.spend)}; cost per result ${x.cpr ?? 'None'}; starts ${get(r, 'Starts').slice(0, 10)}; ends ${get(r, 'Ends').slice(0, 10)}`)
  }
  return {
    kind: 'meta_ads',
    file,
    label: UPLOAD_LABELS.meta_ads,
    summary: [period, `${camps.length} campaigns, ${sets.length} ad sets`, `${cur} ${fmt(totSpend)} spent`, `${fmt(totResults)} results reported by Meta`].filter(Boolean),
    text: lines.join('\n'),
  }
}

// --- 4. Reviews export (CSV with rating and text columns, or Google Takeout JSON) ----------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const STAR_WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }

export function importReviews(file: string, input: string[][] | unknown): Imported {
  let reviews: { rating: number; text: string; date: string }[] = []
  if (Array.isArray(input) && Array.isArray(input[0])) {
    const { header, body } = table(input as string[][])
    const ri = header.findIndex((h) => /rating|stars?|score/.test(h))
    // Text column: "comment" first, then "review" or "text". Never a reviewer or name column.
    const textCol = (re: RegExp) => header.findIndex((h) => re.test(h) && !/reviewer|author|name|date|id\b|reply|response|url/.test(h))
    const ti = [/comment/, /^(review|review text|text|body|content)$/, /review|text/].map(textCol).find((i) => i >= 0) ?? -1
    const di = header.findIndex((h) => /date|time|created/.test(h))
    if (ri < 0) throw new Error('No rating column found in the reviews file.')
    reviews = body.map((r) => ({ rating: STAR_WORDS[String(r[ri]).toUpperCase()] ?? n0(r[ri]), text: ti >= 0 ? String(r[ti] ?? '') : '', date: di >= 0 ? String(r[di]).slice(0, 10) : '' }))
  } else {
    const list = ((input as { reviews?: unknown[] })?.reviews ?? (Array.isArray(input) ? input : [])) as Record<string, unknown>[]
    reviews = list.map((r) => ({
      rating: STAR_WORDS[String(r.starRating ?? '').toUpperCase()] ?? n0(r.starRating ?? r.rating),
      text: String(r.comment ?? r.text ?? ''),
      date: String(r.createTime ?? r.date ?? '').slice(0, 10),
    }))
  }
  reviews = reviews.filter((r) => r.rating >= 1 && r.rating <= 5)
  if (!reviews.length) throw new Error('No reviews with a star rating found in the file.')
  const avg = round(sum(reviews.map((r) => r.rating)) / reviews.length, 1)
  const withText = reviews.filter((r) => r.text.trim())
  const dist = [5, 4, 3, 2, 1].map((s) => `${s} stars ${reviews.filter((r) => r.rating === s).length}`).join('; ')
  // Reviewer names are never read. Review text is kept for theme counting (the 30 percent rule, decision D23).
  const lines = [
    `Reviews export ${file}`,
    `reviews ${reviews.length} average rating ${avg} reviews with text ${withText.length}`,
    `rating distribution: ${dist}`,
    ...withText.map((r, i) => `review ${i + 1} (${r.rating} stars${r.date ? `, ${r.date}` : ''}): ${r.text.replace(/\s+/g, ' ').trim()}`),
  ]
  return {
    kind: 'reviews',
    file,
    label: UPLOAD_LABELS.reviews,
    summary: [`${reviews.length} reviews`, `average ${avg}`, `${withText.length} with text`, withText.length < 10 ? 'Under 10 with text: themes will become questions' : ''].filter(Boolean),
    text: lines.join('\n'),
    flags: { reviews_count: withText.length },
  }
}

// --- 5. Social snapshot (import_social.py) ----------------------------------------------------

export function importSocial(file: string, raw: unknown[][]): Imported {
  const rows = raw.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c == null ? '' : String(c))))
  const hi = rows.findIndex((r) => r.includes('Brand') && r.includes('Platform'))
  if (hi < 0) throw new Error('This is not the social snapshot template (no Brand and Platform columns).')
  const header = rows[hi]
  const get = (r: string[], name: string) => r[header.indexOf(name)] ?? ''
  const body = rows.slice(hi + 1).filter((r) => r.some((c) => c.trim()) && !/example row/i.test(get(r, 'Notes')))
  const lines = [`Social snapshot export ${file}`]
  for (const r of body) {
    const n = n0(get(r, 'Posts counted'))
    const inter = n0(get(r, 'Likes (last 10)')) + n0(get(r, 'Comments (last 10)')) + n0(get(r, 'Shares (last 10)'))
    const avg = n ? round(inter / n) : null
    const fol = n0(get(r, 'Followers'))
    const rate = avg !== null && fol && n >= 10 ? round((avg / fol) * 100, 2) : null
    const snap = Date.parse(get(r, 'Snapshot date'))
    const last = Date.parse(get(r, 'Last post date'))
    const days = Number.isFinite(snap) && Number.isFinite(last) ? Math.floor((snap - last) / 86400000) : null
    lines.push(
      `${get(r, 'Brand')} ${get(r, 'Platform')}: followers ${fmt(fol)}; posts last 30 days ${fmt(n0(get(r, 'Posts last 30 days')))}; average interactions per post ${avg ?? 'None'}; engagement rate ${rate ?? 'None'}%; days since last post ${days ?? 'None'}${days !== null && days > 90 ? ' (inactive over 90 days)' : ''}; formats ${get(r, 'Formats')}; snapshot ${get(r, 'Snapshot date').slice(0, 10)}`,
    )
  }
  return { kind: 'social', file, label: UPLOAD_LABELS.social, summary: [`${body.length} profiles`], text: lines.join('\n') }
}

// --- detection ------------------------------------------------------------------------------

// Works out which importer fits. `sheets` is set for spreadsheets, `text` for CSV and JSON files.
export function importUpload(args: { file: string; text?: string; sheets?: { sheet: string; data: unknown[][] }[]; clientName: string }): Imported {
  const brand = brandTerms(args.clientName)
  const { file, text, sheets } = args
  if (sheets) {
    const snapshot = sheets.find((s) => s.sheet === 'Snapshot')
    if (snapshot) return importSocial(file, snapshot.data)
    const raw = sheets.find((s) => s.sheet === 'Raw Data Report') ?? sheets[0]
    if (raw.data.some((r) => r.includes('Campaign name'))) return importMetaAds(file, raw.data)
    const strRows = raw.data.map((r) => r.map((c) => (c == null ? '' : String(c))))
    const h = (strRows[0] ?? []).join(',').toLowerCase()
    if (/rating|stars/.test(h)) return importReviews(file, strRows)
    if (/quer|page/.test(h) && h.includes('clicks')) return importGsc(file, strRows, brand)
    throw new Error('Not a file we can read yet. Upload a GA4 overview CSV, Search Console export, Meta Ads report, reviews export or the social snapshot.')
  }
  const t = text ?? ''
  if (file.toLowerCase().endsWith('.json')) return importReviews(file, JSON.parse(t))
  if (/^#\s*(Account|Property|Start date)/m.test(t) || t.includes('Nth week,New users')) return importGa4Overview(file, t, brand)
  const rows = parseCsv(t)
  if (rows.some((r) => r.includes('Campaign name'))) return importMetaAds(file, rows)
  const h = (rows[0] ?? []).join(',').toLowerCase()
  if (/quer|page/.test(h) && h.includes('clicks')) return importGsc(file, rows, brand)
  if (/rating|stars/.test(h)) return importReviews(file, rows)
  throw new Error('Not a file we can read yet. Upload a GA4 overview CSV, Search Console export, Meta Ads report, reviews export or the social snapshot.')
}
