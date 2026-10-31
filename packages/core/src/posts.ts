// Writing a post: the prompt (ported from skills/client-content-pack references blog-rules.md, social-rules.md
// and the image section of creative-rules.md), the output schema, and the combined check run.
import { COVER_RULES, COVER_SCHEMA, checkCover, type CoverText } from './cover'
import { buildBlog, checkBlog, checkSocial, parseBlog, type BlogClient } from './blog'
import type { Channel, Check, ImageKeyword, Social } from './types'
import { CHANNEL_LABELS } from './types'
import type { VoiceProfile } from './voice'

export type PostTopic = { title: string; gist?: string | null; who_asks?: string | null; service?: string | null; why?: string | null }

export type PostResult = {
  blog_md: string
  social: Social
  image_keywords: ImageKeyword[]
  image_avoid?: string
  cover?: CoverText
}

export function postSchema(channels: Channel[]) {
  const social = (ch: Channel) => ({
    type: 'object',
    description: `${CHANNEL_LABELS[ch]} post`,
    properties: { text: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } },
    required: ['text', 'hashtags'],
  })
  return {
    type: 'object',
    properties: {
      blog_md: { type: 'string', description: 'The full blog post as Markdown, starting with the front matter.' },
      social: { type: 'object', properties: Object.fromEntries(channels.map((c) => [c, social(c)])), required: channels },
      image_keywords: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: { type: 'object', properties: { phrase: { type: 'string' }, why: { type: 'string' } }, required: ['phrase', 'why'] },
      },
      image_avoid: { type: 'string', description: 'What to avoid in the photo, one short sentence.' },
      cover: COVER_SCHEMA,
    },
    required: ['blog_md', 'social', 'image_keywords', 'image_avoid', 'cover'],
  }
}

export const BLOG_RULES = `Blog rules:
- Front matter first, exactly these keys: title, slug (question words, hyphenated), meta_description (under 155 characters, answers the question), date.
- Title: a plain question or clear statement under 65 characters with the main question in it.
- Short answer: the first paragraph, 35 to 70 words. It fully answers the title question. Name the business and the place once.
- Then 3 to 5 sections. Each H2 is a question a real person would ask. Each section opens with a one-sentence direct answer, then two to four short sentences. Name the subject instead of starting with "it" or "this" so each section makes sense quoted alone.
- Use a numbered list for steps and a bullet list for options. A small table only to compare things. Skip them when the answer is one sentence.
- The last H2 is "Quick answers": three to five H3 questions, each answer 40 words or fewer.
- Then one short "next step" paragraph with the call to action. Link it only to a URL given below; never invent a link.
- Sources: add a "Sources" H2 with links only for a fact, number, law, price or date that did not come from the approved facts. If you have none, leave Sources out and avoid numbers.
- 400 to 900 words. Paragraphs of one to three sentences. Average sentence under 18 words. Reading grade 8 or lower. Say "use", not "utilize".
- Write to one person ("you"). Use "we" sparingly. Name the business in the short answer and in the next step.
- No filler openers ("In this article", "Let's explore", "Are you looking for"). No exclamation marks. No rhetorical questions inside paragraphs.
- Be specific: places, services, steps, seasons. General practical advice is fine without a source. Never invent statistics, awards, years in business, prices, guarantees or customer counts.`

export const SOCIAL_RULES = `Social post rules:
- Only the gist. One idea per post, written like a person talking. Start with the point or a short question. No greeting.
- Give the gist of the blog answer in one or two sentences. Do not retell the post.
- Limits: Facebook 200 characters, LinkedIn 240, Instagram 140 (characters before hashtags). Hashtags go in the hashtags list, not in the text. Facebook 0 or 1, LinkedIn 0 to 2, Instagram 0 to 3.
- Facebook and LinkedIn end with the placeholder {link} in the text. Instagram has no link: end with "Link in bio."
- Emoji: Facebook 0 or 1, LinkedIn none, Instagram 0 or 1. No exclamation marks, or one at most on Instagram.
- Each channel gets its own wording. No numbers or claims that are not in the blog post.`

export const IMAGE_RULES = `Image keywords: exactly five stock-photo search phrases of three to five concrete words each (for example "autumn lawn raking"), from different angles. Describe a real photo someone could find: one clear subject, natural light, no text or logos. In "image_avoid" say what to skip (obvious stock poses, busy detail, visible faces of private people).`

export { COVER_RULES }

export type PostContext = {
  topic: PostTopic
  today: string
  channels: Channel[]
  voice: Pick<VoiceProfile, 'hashtags' | 'emoji'>
  client: BlogClient & { cta_text?: string | null; cta_url?: string | null; location?: string | null }
}

export function postInstruction(c: PostContext, retry?: { previous: PostResult; problems: string[] }): string {
  const svc = (c.client.services ?? []).find((s) => s.name.toLowerCase() === (c.topic.service ?? '').toLowerCase())
  const links = [
    svc?.url && `Service page for this topic (${svc.name}): ${svc.url}`,
    c.client.cta_text && `Call to action: "${c.client.cta_text}"${c.client.cta_url ? ` linking to ${c.client.cta_url}` : ' (no link given, so write it without a link)'}`,
  ].filter(Boolean)
  const parts = [
    `Write one blog post, social copy for ${c.channels.map((x) => CHANNEL_LABELS[x]).join(', ')}, five image search phrases, and the cover text for the image. Use the "post" tool.`,
    [
      `Topic: ${c.topic.title}`,
      c.topic.who_asks && `Who asks: ${c.topic.who_asks}`,
      c.topic.gist && `Gist of the answer: ${c.topic.gist}`,
      c.topic.service && `Linked service: ${c.topic.service}`,
      c.topic.why && `Why this topic: ${c.topic.why}`,
      `Date for the front matter: ${c.today}`,
      c.client.author_name && `Author: ${c.client.author_name}${c.client.author_role ? `, ${c.client.author_role}` : ''} (used in the page markup only; do not write a byline)`,
    ]
      .filter(Boolean)
      .join('\n'),
    links.length ? `Links you may use (use none other):\n${links.map((l) => `- ${l}`).join('\n')}` : 'No links are given, so write the next step without a link.',
    `Social voice: hashtags "${c.voice.hashtags}", emoji "${c.voice.emoji}" (never more than the channel limits).`,
    BLOG_RULES,
    SOCIAL_RULES,
    IMAGE_RULES,
    COVER_RULES,
  ]
  if (retry) {
    parts.push(
      `Your previous draft, as JSON:\n${JSON.stringify(retry.previous)}\n\nIt broke these rules:\n${retry.problems.map((p) => `- ${p}`).join('\n')}\n\nReturn the full corrected result. Fix every item by rewriting the text, keep everything else that was fine.`,
    )
  }
  return parts.join('\n\n')
}

export type PostChecked = {
  checks: Check[]
  title: string
  body_md: string
  body_html: string
  faq: { q: string; a: string }[]
  stats: ReturnType<typeof checkBlog>['stats'] | null
}

const FAIL_STATUSES = new Set(['fail'])

// Builds the HTML and runs every check. Never throws: a draft that cannot be built gets a failed "build" check.
export function checkPost(result: PostResult, ctx: { client: BlogClient; avoid?: string[]; channels: Channel[] }): PostChecked {
  const raw = result.blog_md ?? ''
  const { fm } = parseBlog(raw)
  const blog = checkBlog(raw, { client: ctx.client, avoid: ctx.avoid })
  const social = checkSocial(result.social ?? {}, { avoid: ctx.avoid, channels: ctx.channels })
  const checks = [...blog.checks, ...social.checks]
  if (result.cover) checks.push(checkCover(result.cover, { avoid: ctx.avoid }))
  let body_html = ''
  let faq: { q: string; a: string }[] = []
  try {
    const built = buildBlog(raw, ctx.client)
    body_html = built.html
    faq = built.faq
  } catch (e) {
    checks.unshift({ id: 'build', label: 'Page build', status: 'fail', note: (e as Error).message })
  }
  return { checks, title: fm.title ?? '', body_md: raw, body_html, faq, stats: blog.stats }
}

// The failing and warning notes, as short lines, for the rewrite pass.
export const problemsFrom = (checks: Check[], levels: ('fail' | 'warn')[] = ['fail']) =>
  checks.filter((c) => levels.includes(c.status as 'fail' | 'warn') && c.note).map((c) => `${c.label}: ${c.note}`)

export const hasFailures = (checks: Check[]) => checks.some((c) => FAIL_STATUSES.has(c.status))

// What the blog builder and checks need to know about a client, from the clients row and its voice.
export function blogClientFrom(
  c: { name: string; website?: string | null; author_name?: string | null; author_role?: string | null; services?: { name: string; url?: string }[] | null; cta_text?: string | null; cta_url?: string | null; location?: string | null },
  spelling: VoiceProfile['spelling'],
): BlogClient & { cta_text?: string | null; cta_url?: string | null; location?: string | null } {
  return {
    name: c.name,
    website: c.website ?? null,
    language: spelling === 'us' ? 'en-US' : spelling === 'uk' ? 'en-GB' : 'en-CA',
    author_name: c.author_name ?? null,
    author_role: c.author_role ?? null,
    services: c.services ?? [],
    cta_text: c.cta_text ?? null,
    cta_url: c.cta_url ?? null,
    location: c.location ?? null,
  }
}
