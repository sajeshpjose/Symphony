// Website crawler for research runs.
// Follows links found on fetched pages only (never guessed paths), honours robots.txt,
// reads public HTML pages, and keeps their text so every quote can be checked later.
import { createHash } from 'node:crypto'
import { parse, type HTMLElement } from 'node-html-parser'

export const USER_AGENT = 'SymphResearch/1.0 (+https://dotyello.com)'

export type Page = { url: string; title: string; text: string; words: number }
export type CrawlResult = { pages: Page[]; failed: { url: string; reason: string }[]; blockedByRobots: boolean }

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|docx?|xlsx?|pptx?|mp4|mov|mp3|css|js|xml|json|txt)$/i
const SKIP_PATH = /\/(wp-admin|wp-login|login|signin|sign-in|account|cart|checkout|my-account|feed|tag|author|search)(\/|$)|\/wp-json\//i

// Paths worth reading first, in rough order of value for the report.
const PRIORITY: [RegExp, number][] = [
  [/about|who-we-are|our-story|company/i, 10],
  [/service|what-we-do|solutions|offer|products?|treatments?|programs?/i, 10],
  [/pric|rates|fees|packages|plans|cost/i, 9],
  [/locations?|areas?|service-area|where|cities|regions?/i, 8],
  [/testimonial|reviews?|case-stud|our-work|portfolio|projects?|clients/i, 8],
  [/team|staff|people|leadership/i, 6],
  [/faq|questions/i, 6],
  [/industr|sectors|who-we-serve|for-/i, 6],
  [/contact/i, 5],
  [/mission|values|vision|why/i, 5],
  [/blog|news|insights|resources|articles/i, 3],
]

export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const withScheme = !base && !/^https?:\/\//i.test(raw.trim()) ? `https://${raw.trim()}` : raw.trim()
    const u = new URL(withScheme, base)
    if (!/^https?:$/.test(u.protocol)) return null
    u.hash = ''
    u.search = ''
    let s = u.toString()
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1)
    return s
  } catch {
    return null
  }
}

const hostKey = (u: string) => new URL(u).hostname.replace(/^www\./, '').toLowerCase()

function score(url: string, depth: number, inNav: boolean): number {
  const path = new URL(url).pathname
  let s = 0
  for (const [re, w] of PRIORITY) if (re.test(path)) s = Math.max(s, w)
  if (inNav) s += 4
  s -= depth * 2
  s -= Math.max(0, path.split('/').filter(Boolean).length - 2) * 2 // deep paths (single blog posts) last
  return s
}

// --- robots.txt -------------------------------------------------------------

type Robots = { disallow: string[]; allow: string[] }

async function loadRobots(origin: string): Promise<Robots> {
  const empty = { disallow: [], allow: [] }
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return empty
    const lines = (await res.text()).split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim())
    const groups: { agents: string[]; rules: Robots }[] = []
    let current: { agents: string[]; rules: Robots } | null = null
    let lastWasAgent = false
    for (const line of lines) {
      const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i)
      if (!m) continue
      const [, key, value] = m
      if (key.toLowerCase() === 'user-agent') {
        if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: { disallow: [], allow: [] } }))
        current.agents.push(value.toLowerCase())
        lastWasAgent = true
      } else {
        lastWasAgent = false
        if (!current) continue
        if (key.toLowerCase() === 'disallow' && value) current.rules.disallow.push(value)
        if (key.toLowerCase() === 'allow' && value) current.rules.allow.push(value)
      }
    }
    const ours = groups.find((g) => g.agents.some((a) => a !== '*' && USER_AGENT.toLowerCase().startsWith(a)))
    return (ours ?? groups.find((g) => g.agents.includes('*')))?.rules ?? empty
  } catch {
    return empty
  }
}

function robotsAllows(robots: Robots, url: string): boolean {
  const path = new URL(url).pathname
  const match = (rule: string) => {
    const re = new RegExp('^' + rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'))
    return re.test(path)
  }
  const longest = (rules: string[]) => Math.max(-1, ...rules.filter(match).map((r) => r.length))
  return longest(robots.allow) >= longest(robots.disallow)
}

// --- page fetch and text ----------------------------------------------------

function cleanText(root: HTMLElement): string {
  root.querySelectorAll('script, style, noscript, svg, iframe, template, form, [aria-hidden="true"]').forEach((n) => n.remove())
  const body = root.querySelector('main') && (root.querySelector('main')!.structuredText.split(/\s+/).length > 150) ? root : root.querySelector('body') ?? root
  return body.structuredText
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export async function fetchPage(url: string): Promise<{ page: Page; links: { url: string; inNav: boolean }[] } | { error: string }> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
  } catch (e) {
    return { error: (e as Error).name === 'TimeoutError' ? 'timed out' : 'could not connect' }
  }
  if (!res.ok) return { error: `status ${res.status}` }
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('html')) return { error: 'not an HTML page' }
  const html = (await res.text()).slice(0, 2_000_000)
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, pre: true } })
  const finalUrl = normalizeUrl(res.url || url) ?? url
  const title = (root.querySelector('title')?.text ?? '').replace(/\s+/g, ' ').trim()
  const links: { url: string; inNav: boolean }[] = []
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') ?? ''
    if (/^(mailto|tel|javascript|sms):/i.test(href)) continue
    const abs = normalizeUrl(href, finalUrl)
    if (!abs) continue
    const inNav = !!a.closest('nav, header, footer')
    links.push({ url: abs, inNav })
  }
  const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()
  const text = [metaDesc, cleanText(root)].filter(Boolean).join('\n')
  return { page: { url: finalUrl, title, text, words: text.split(/\s+/).filter(Boolean).length }, links }
}

// --- crawl --------------------------------------------------------------------

export async function crawlSite(
  start: string,
  opts: { maxPages: number; maxDepth?: number; onPage?: (n: number, url: string) => Promise<void> | void },
): Promise<CrawlResult> {
  const first = normalizeUrl(start)
  if (!first) return { pages: [], failed: [{ url: start, reason: 'not a valid web address' }], blockedByRobots: false }
  const origin = new URL(first).origin
  const robots = await loadRobots(origin)
  const host = hostKey(first)
  const maxDepth = opts.maxDepth ?? 2
  const seen = new Set<string>([first])
  const seenText = new Set<string>()
  const queue: { url: string; depth: number; score: number }[] = [{ url: first, depth: 0, score: 100 }]
  const pages: Page[] = []
  const failed: { url: string; reason: string }[] = []
  let blockedByRobots = false

  while (queue.length && pages.length < opts.maxPages) {
    queue.sort((a, b) => b.score - a.score)
    const next = queue.shift()!
    if (!robotsAllows(robots, next.url)) {
      if (next.depth === 0) blockedByRobots = true
      failed.push({ url: next.url, reason: 'blocked by robots.txt' })
      continue
    }
    const r = await fetchPage(next.url)
    if ('error' in r) {
      failed.push({ url: next.url, reason: r.error })
      continue
    }
    if (hostKey(r.page.url) !== host) continue // redirected off-site
    const hash = createHash('sha1').update(r.page.text).digest('hex')
    if (seenText.has(hash)) continue
    seenText.add(hash)
    if (r.page.url !== next.url) seen.add(r.page.url)
    pages.push(r.page)
    await opts.onPage?.(pages.length, r.page.url)
    if (next.depth >= maxDepth) continue
    for (const l of r.links) {
      if (seen.has(l.url)) continue
      let lh: string
      try {
        lh = hostKey(l.url)
      } catch {
        continue
      }
      if (lh !== host) continue
      const path = new URL(l.url).pathname
      if (SKIP_EXT.test(path) || SKIP_PATH.test(path)) continue
      seen.add(l.url)
      queue.push({ url: l.url, depth: next.depth + 1, score: score(l.url, next.depth + 1, l.inNav) })
    }
  }
  return { pages, failed, blockedByRobots }
}
