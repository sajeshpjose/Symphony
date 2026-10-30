// Deterministic copy checks, ported from skills/client-content-pack/scripts/lint_copy.py.
// They run instantly and cost nothing; Claude-based checks (claims, facts) are separate.
import { BANNED_WORDS } from './banned-words'

export type LintIssue = { level: 'fail' | 'warn'; message: string; match?: string }

const DASHES: Record<string, string> = { '—': 'em dash', '–': 'en dash', '―': 'horizontal bar', '‒': 'figure dash' }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function wordPattern(w: string): RegExp {
  return w.endsWith('*') ? new RegExp(`\\b${esc(w.slice(0, -1))}\\w*`, 'gi') : new RegExp(`(?<!\\w)${esc(w)}(?!\\w)`, 'gi')
}

const near = (text: string, i: number, len: number) => text.slice(Math.max(0, i - 25), i + len + 25).trim()

// Dashes, banned words (plus the client's own avoid list), and the two cliché patterns.
export function lintText(text: string, opts: { avoid?: string[]; label?: string } = {}): LintIssue[] {
  const out: LintIssue[] = []
  const label = opts.label ? `${opts.label}: ` : ''
  for (const [ch, name] of Object.entries(DASHES)) {
    let i = text.indexOf(ch)
    while (i !== -1) {
      out.push({ level: 'fail', message: `${label}${name} near "${near(text, i, 1)}"`, match: ch })
      i = text.indexOf(ch, i + 1)
    }
  }
  if (/--/.test(text)) out.push({ level: 'fail', message: `${label}double hyphen used as a dash`, match: '--' })
  for (const m of text.matchAll(/\s-\s/g)) out.push({ level: 'warn', message: `${label}spaced hyphen used like a dash near "${near(text, m.index!, 3)}"` })
  for (const w of BANNED_WORDS) {
    for (const m of text.matchAll(wordPattern(w))) out.push({ level: 'fail', message: `${label}banned word "${m[0]}" near "${near(text, m.index!, m[0].length)}"`, match: m[0] })
  }
  for (const w of opts.avoid ?? []) {
    if (!w.trim()) continue
    for (const m of text.matchAll(wordPattern(w.trim().toLowerCase()))) {
      out.push({ level: 'fail', message: `${label}"${m[0]}" is on the client's avoid list`, match: m[0] })
    }
  }
  if (/\bnot (?:just|only|merely) [^.?!]{0,60}\bbut\b/i.test(text)) out.push({ level: 'fail', message: `${label}"not just ... but" pattern` })
  if (/\b(?:it|this) (?:is|'s) not about\b/i.test(text)) out.push({ level: 'fail', message: `${label}"it is not about" pattern` })
  return out
}

// Rough US reading grade (Flesch-Kincaid), same formula as the Python script.
export function readingGrade(text: string): number {
  const sents = text.trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).filter((s) => s.trim())
  const words = text.match(/[A-Za-z']+/g) ?? []
  if (!sents.length || !words.length) return 0
  const syl = (w: string) => {
    let s = w.toLowerCase().replace(/[^a-z]/g, '')
    if (!s) return 0
    if (s.length <= 3) return 1
    s = s.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
    return Math.max(1, (s.match(/[aeiouy]{1,2}/g) ?? []).length)
  }
  const total = words.reduce((n, w) => n + syl(w), 0)
  return 0.39 * (words.length / sents.length) + 11.8 * (total / words.length) - 15.59
}
