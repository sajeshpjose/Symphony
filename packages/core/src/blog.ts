// Blog builder and post checks, ported from skills/client-content-pack/scripts/build_blog.py and lint_copy.py.
// Pure functions, no network: they run in the post-batch task, in the review screen and in tests.
import type { Check, Channel, Social } from './types'
import { lintText, readingGrade, type LintIssue } from './lint'

export type BlogMeta = { title: string; slug: string; meta_description: string; date: string; updated?: string }

export type BlogClient = {
  name: string
  website?: string | null
  language?: string // "en-CA"
  logo_url?: string | null
  author_name?: string | null
  author_role?: string | null
  services?: { name: string; url?: string }[]
}

export const POST_LIMITS: Record<Channel, number> = { facebook: 200, linkedin: 240, instagram: 140 }
const HASHTAG_MAX: Record<Channel, number> = { facebook: 1, linkedin: 2, instagram: 3 }
const EMOJI_MAX: Record<Channel, number> = { facebook: 1, linkedin: 0, instagram: 1 }
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{2B50}\u{2B06}\u{2194}-\u{21AA}]/gu

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/
const words = (t: string) => t.split(/\s+/).filter(Boolean).length
const sentences = (t: string) => t.trim().split(SENTENCE_SPLIT).filter((s) => s.trim())

export function stripMd(t: string): string {
  return t
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const escHtml = (s: string, quote = false) => {
  const out = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return quote ? out.replace(/"/g, '&quot;') : out
}

// ---- Parse ---------------------------------------------------------------------------------

export function parseBlog(raw: string): { fm: Record<string, string>; body: string } {
  const fm: Record<string, string> = {}
  let body = raw
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    body = raw.slice(m[0].length)
  }
  return { fm, body: body.trim() + '\n' }
}

// ---- Markdown to HTML (the subset blog-rules.md allows) -------------------------------------

const inline = (t: string) =>
  escHtml(t)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => `<a href="${escHtml(href, true)}">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

const plain = (t: string) => t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim()

export function mdToHtml(body: string): string {
  const out: string[] = []
  const lines = body.split('\n')
  let i = 0
  let firstP = true
  const isUl = (l: string) => /^\s*[-*]\s+/.test(l)
  const isOl = (l: string) => /^\s*\d+\.\s+/.test(l)
  while (i < lines.length) {
    const ln = lines[i]
    if (!ln.trim()) { i++; continue }
    const h = ln.match(/^(#{2,3})\s+(.+)$/)
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue }
    if (isUl(ln) || isOl(ln)) {
      const ordered = isOl(ln)
      const items: string[] = []
      while (i < lines.length && (ordered ? isOl(lines[i]) : isUl(lines[i]))) items.push(lines[i++].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, ''))
      const tag = ordered ? 'ol' : 'ul'
      out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`)
      continue
    }
    if (ln.trim().startsWith('|')) {
      let rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
      rows = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)))
      if (!rows.length) continue
      const [head, ...rest] = rows
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      )
      continue
    }
    const para = [ln.trim()]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|\s*[-*]\s|\s*\d+\.\s|\|)/.test(lines[i])) para.push(lines[i++].trim())
    out.push(`<p${firstP ? ' class="short-answer"' : ''}>${inline(para.join(' '))}</p>`)
    firstP = false
  }
  return out.join('\n')
}

export function faqPairs(body: string): { q: string; a: string }[] {
  const m = body.match(/^##\s+Quick answers\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m)
  if (!m) return []
  const pairs: { q: string; a: string }[] = []
  for (const blk of m[1].split(/^###\s+/m).slice(1)) {
    const nl = blk.indexOf('\n')
    const q = plain(nl === -1 ? blk : blk.slice(0, nl))
    const a = plain(nl === -1 ? '' : blk.slice(nl + 1))
    if (q && a) pairs.push({ q, a })
  }
  return pairs
}

// ---- Build ------------------------------------------------------------------------------------

export type BuiltBlog = {
  html: string
  schema: Record<string, unknown>
  faq: { q: string; a: string }[]
  meta: BlogMeta
  url: string
}

// Turns the Markdown draft into HTML with Article, FAQPage and Organization markup (JSON-LD).
export function buildBlog(raw: string, client: BlogClient, opts: { url?: string } = {}): BuiltBlog {
  const { fm, body } = parseBlog(raw)
  for (const k of ['title', 'slug', 'meta_description', 'date'] as const) if (!fm[k]) throw new Error(`front matter missing: ${k}`)
  const meta: BlogMeta = { title: fm.title, slug: fm.slug, meta_description: fm.meta_description, date: fm.date, updated: fm.updated }
  const site = (client.website ?? '').replace(/^(?!https?:)/, 'https://').replace(/\/+$/, '')
  const url = opts.url || (client.website ? `${site}/blog/${meta.slug}` : '')
  const lang = client.language || 'en'
  const intro = body.split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith('#'))
  const short = intro ? plain(intro) : ''
  const org: Record<string, unknown> = { '@type': 'Organization', name: client.name, url: client.website ? site : '' }
  if (client.logo_url) org.logo = { '@type': 'ImageObject', url: client.logo_url }
  const author = client.author_name
    ? { '@type': 'Person', name: client.author_name, jobTitle: client.author_role ?? '' }
    : org
  const updated = meta.updated ?? meta.date
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Article',
      headline: meta.title.slice(0, 110),
      description: meta.meta_description,
      abstract: short,
      datePublished: meta.date,
      dateModified: updated,
      inLanguage: lang,
      mainEntityOfPage: url,
      publisher: org,
      author,
      about: (client.services ?? []).slice(0, 3).map((s) => ({ '@type': 'Thing', name: s.name })),
    },
    org,
  ]
  const faq = faqPairs(body)
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    })
  }
  const schema = { '@context': 'https://schema.org', '@graph': graph }
  const byline =
    (client.author_name ? `By ${escHtml(client.author_name)}${client.author_role ? `, ${escHtml(client.author_role)}` : ''}, ${escHtml(client.name)}. ` : '') +
    `Updated ${escHtml(updated)}.`
  const html = `<!doctype html>
<html lang="${escHtml(lang, true)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(meta.title)}</title>
<meta name="description" content="${escHtml(meta.meta_description, true)}">
${url ? `<link rel="canonical" href="${escHtml(url, true)}">\n` : ''}<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c')}
</script>
</head>
<body>
<article>
<header>
<h1>${escHtml(meta.title)}</h1>
<p class="byline">${byline}</p>
</header>
${mdToHtml(body)}
</article>
</body>
</html>
`
  return { html, schema, faq, meta, url }
}

// ---- Checks -----------------------------------------------------------------------------------

export type BlogStats = { words: number; reading_grade: number; short_answer_words: number; question_sections: string }

type Issue = { level: 'fail' | 'warn'; message: string }
const fail = (message: string): Issue => ({ level: 'fail', message })
const warn = (message: string): Issue => ({ level: 'warn', message })
const fromLint = (l: LintIssue[]): Issue[] => l.map((x) => ({ level: x.level, message: x.message }))

// Groups issues into the named checks shown in the review screen. A check with no issues passes.
function group(id: string, label: string, issues: Issue[]): Check {
  const failed = issues.filter((i) => i.level === 'fail')
  const status = failed.length ? 'fail' : issues.length ? 'warn' : 'pass'
  return { id, label, status, note: issues.map((i) => i.message).join('; ') || undefined }
}

export function checkBlog(raw: string, ctx: { client: BlogClient; avoid?: string[] }): { checks: Check[]; stats: BlogStats } {
  const { fm, body } = parseBlog(raw)
  const meta: Issue[] = []
  for (const k of ['title', 'slug', 'meta_description', 'date']) if (!fm[k]) meta.push(fail(`front matter missing ${k}`))
  if ((fm.title ?? '').length > 65) meta.push(warn(`title is ${fm.title.length} characters (limit 65)`))
  if ((fm.meta_description ?? '').length > 155) meta.push(fail(`meta description is ${fm.meta_description.length} characters (limit 155)`))

  const wordsIssues = fromLint(lintText(raw.replace(/^---\s*$/gm, ''), { avoid: ctx.avoid, label: 'blog' }))
  if (raw.includes('!')) wordsIssues.push(warn('blog: exclamation mark found'))

  const struct: Issue[] = []
  const h2 = [...body.matchAll(/^##\s+(.+?)\s*$/gm)]
  const sections = h2.map((m, i) => ({ title: m[1], content: body.slice(m.index! + m[0].length, i + 1 < h2.length ? h2[i + 1].index : undefined).trim() }))
  const intro = (h2.length ? body.slice(0, h2[0].index) : body).trim()
  const introP = intro.split(/\n\s*\n/).filter((p) => p.trim() && !p.trim().startsWith('#'))
  const short = introP.length ? stripMd(introP[0]) : ''
  const sw = words(short)
  if (!short) struct.push(fail('missing short answer: the first paragraph'))
  else if (sw < 35 || sw > 70) struct.push(warn(`short answer is ${sw} words (aim for 35 to 70)`))

  const names = sections.filter((s) => !['sources', 'quick answers'].includes(s.title.toLowerCase()))
  const q = names.filter((s) => s.title.trim().endsWith('?'))
  if (names.length && q.length / names.length < 0.7) struct.push(warn(`only ${q.length} of ${names.length} subheadings are questions (aim for 70% or more)`))
  if (names.length < 3) struct.push(warn(`only ${names.length} question sections (aim for 3 to 5)`))
  for (const s of names) {
    const paras = s.content.split(/\n\s*\n/).filter((p) => p.trim())
    if (paras.length) {
      const first = stripMd(paras[0])
      if (words(first) > 60 && !/^\s*(?:[-*]|\d+\.)/.test(paras[0])) struct.push(warn(`section "${s.title}": opening paragraph is ${words(first)} words`))
      const fs = sentences(first)[0]
      if (fs && words(fs) > 28) struct.push(warn(`section "${s.title}": first sentence is ${words(fs)} words`))
      if (/^(?:it|this|that|they|these|those)\b/i.test(first)) struct.push(warn(`section "${s.title}": starts with a pronoun; name the subject`))
    }
    for (const p of paras) {
      if (/^\s*(?:[-*|]|###|\d+\.)/.test(p)) continue
      const pw = words(stripMd(p))
      if (pw > 70) struct.push(warn(`section "${s.title}": a paragraph is ${pw} words (limit 70)`))
    }
  }
  const faq = sections.find((s) => s.title.toLowerCase() === 'quick answers')
  if (!faq) struct.push(warn('no "Quick answers" section for FAQ markup'))
  else {
    const qs = [...faq.content.matchAll(/^###\s+(.+?)\s*$/gm)]
    if (qs.length < 3) struct.push(warn(`Quick answers has ${qs.length} questions (aim for 3 to 5)`))
    for (const blk of faq.content.split(/^###\s+.+$/m).slice(1)) {
      const n = words(stripMd(blk))
      if (n > 45) struct.push(warn(`a quick answer is ${n} words (limit about 40)`))
    }
  }

  const textOnly = stripMd(sections.filter((s) => s.title.toLowerCase() !== 'sources').map((s) => s.content).join('\n') + '\n' + intro)
  const wc = words(textOnly)
  const lengthIssues: Issue[] = []
  if (wc < 380 || wc > 950) lengthIssues.push(warn(`body is ${wc} words (aim for 400 to 900)`))

  const readIssues: Issue[] = []
  const ss = sentences(textOnly)
  if (ss.length) {
    const avg = ss.reduce((n, s) => n + words(s), 0) / ss.length
    if (avg > 18) readIssues.push(warn(`average sentence is ${avg.toFixed(1)} words (aim for 18 or fewer)`))
    const long = ss.filter((s) => words(s) > 28)
    if (long.length) readIssues.push(warn(`${long.length} sentence(s) over 28 words`))
  }
  const grade = readingGrade(textOnly)
  if (grade > 8.5) readIssues.push(warn(`reading grade about ${grade.toFixed(1)} (aim for 8 or lower)`))

  // Facts: numbers need sources; the business name and a service link should appear.
  const factIssues: Issue[] = []
  const hasSources = sections.some((s) => s.title.toLowerCase() === 'sources')
  if (/\d/.test(textOnly) && !hasSources) factIssues.push(warn('numbers appear but there is no Sources section'))
  const nm = ctx.client.name
  if (nm) {
    if (!short.toLowerCase().includes(nm.toLowerCase())) factIssues.push(warn(`business name "${nm}" is not in the short answer`))
    if (raw.toLowerCase().split(nm.toLowerCase()).length - 1 < 2) factIssues.push(warn('business name appears fewer than twice'))
  }
  const urls = (ctx.client.services ?? []).map((s) => s.url).filter((u): u is string => !!u)
  if (urls.length && !urls.some((u) => raw.includes(u))) factIssues.push(warn('no link to a service page'))

  return {
    checks: [
      group('meta', 'Title and description', meta),
      group('words', 'Words and patterns', wordsIssues),
      group('structure', 'Structure', struct),
      group('length', 'Length', lengthIssues),
      group('reading', 'Reading level', readIssues),
      group('facts', 'Facts and links', factIssues),
    ],
    stats: { words: wc, reading_grade: Math.round(grade * 10) / 10, short_answer_words: sw, question_sections: `${q.length}/${names.length}` },
  }
}

export function checkSocial(social: Social, ctx: { avoid?: string[]; channels?: Channel[] }): { checks: Check[]; counts: Partial<Record<Channel, number>> } {
  const issues: Issue[] = []
  const counts: Partial<Record<Channel, number>> = {}
  const channels = ctx.channels ?? (Object.keys(POST_LIMITS) as Channel[])
  for (const ch of channels) {
    const post = social[ch]
    if (!post?.text) { issues.push(fail(`${ch}: missing`)); continue }
    const t = [post.text, ...(post.hashtags ?? []).map((h) => (h.startsWith('#') ? h : `#${h}`))].join(' ')
    const tags = t.match(/#\w+/g) ?? []
    const bodyText = t.replace(/\{link\}/g, '').replace(/#\w+/g, '').replace(/\s+/g, ' ').trim()
    counts[ch] = bodyText.length
    if (bodyText.length > POST_LIMITS[ch]) issues.push(fail(`${ch}: ${bodyText.length} characters (limit ${POST_LIMITS[ch]})`))
    if (tags.length > HASHTAG_MAX[ch]) issues.push(fail(`${ch}: ${tags.length} hashtags (limit ${HASHTAG_MAX[ch]})`))
    if ((t.match(EMOJI_RE) ?? []).length > EMOJI_MAX[ch]) issues.push(fail(`${ch}: too many emoji (limit ${EMOJI_MAX[ch]})`))
    if (ch !== 'instagram' && !t.includes('{link}')) issues.push(warn(`${ch}: no {link} placeholder`))
    if (ch === 'instagram' && !/link in bio/i.test(t)) issues.push(warn('instagram: add "Link in bio."'))
    if ((t.match(/!/g) ?? []).length > (ch === 'instagram' ? 1 : 0)) issues.push(fail(`${ch}: exclamation marks`))
    issues.push(...fromLint(lintText(t, { avoid: ctx.avoid, label: ch })))
  }
  const texts = channels.map((c) => (social[c]?.text ?? '').toLowerCase().replace(/\W+/g, ''))
  if (channels.length > 1 && new Set(texts).size < channels.length) issues.push(warn('two channels share the same text; give each its own wording'))
  return { checks: [group('social', 'Social copy', issues)], counts }
}
