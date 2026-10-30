// Cover text for social creatives: three short lines that sit on the photo.
// Rules ported from skills/client-content-pack/references/creative-rules.md and lint_copy.py (check_creative).
import { lintText } from './lint'
import type { Check } from './types'

export type CoverText = { eyebrow: string; heading: string; description: string }

export const COVER_LIMITS: Record<keyof CoverText, number> = { eyebrow: 24, heading: 40, description: 80 }

export const COVER_SCHEMA = {
  type: 'object',
  description: 'Three short lines for the image that goes with the social posts.',
  properties: {
    eyebrow: { type: 'string', description: 'The topic in two or three words. Up to 24 characters.' },
    heading: { type: 'string', description: 'The point, as a short statement or question. Up to 40 characters, six words or fewer when possible.' },
    description: { type: 'string', description: 'One short sentence with the useful detail. Up to 80 characters. Do not repeat the heading.' },
  },
  required: ['eyebrow', 'heading', 'description'],
}

export const COVER_RULES = `Cover text rules (three lines that sit on the image):
- Eyebrow: the topic in two or three words, up to 24 characters. It is shown in capitals.
- Heading: the point as a short statement or question, up to 40 characters, six words or fewer when possible.
- Description: one short sentence that adds the useful detail, up to 80 characters. Do not repeat the heading.
- No dashes, banned words, exclamation marks, hashtags, links or emoji. Minimal character count wins.`

export function checkCover(cover: Partial<CoverText> | null | undefined, opts: { avoid?: string[] } = {}): Check {
  const issues: string[] = []
  let failed = false
  for (const key of Object.keys(COVER_LIMITS) as (keyof CoverText)[]) {
    const v = (cover?.[key] ?? '').trim()
    if (!v) { issues.push(`${key} is missing`); failed = true; continue }
    if (v.length > COVER_LIMITS[key]) { issues.push(`${key} is ${v.length} characters (limit ${COVER_LIMITS[key]})`); failed = true }
    for (const i of lintText(v, { avoid: opts.avoid, label: key })) { issues.push(i.message); if (i.level === 'fail') failed = true }
    if (v.includes('!')) { issues.push(`${key}: exclamation mark`); failed = true }
    if (/https?:\/\/|www\.|#\w/.test(v)) { issues.push(`${key}: no links or hashtags on the image`); failed = true }
  }
  const h = (cover?.heading ?? '').trim().toLowerCase()
  if (h && h === (cover?.description ?? '').trim().toLowerCase()) issues.push('description repeats the heading')
  return { id: 'cover', label: 'Cover text', status: failed ? 'fail' : issues.length ? 'warn' : 'pass', note: issues.join('; ') || undefined }
}

export const trimCover = (c: Partial<CoverText> | null | undefined): CoverText => ({
  eyebrow: (c?.eyebrow ?? '').trim(),
  heading: (c?.heading ?? '').trim(),
  description: (c?.description ?? '').trim(),
})
