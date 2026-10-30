// Topic suggestions: the prompt (ported from skills/client-content-pack/references/topic-rules.md),
// the output schema, and the clean-up that runs on whatever Claude returns.
import { lintText } from './lint'

export type SuggestedTopic = {
  title: string
  who_asks: string
  gist: string
  service: string
  signal: string // where the idea came from: a research fact, a question, or the season
  keyword_primary: string
  keyword_alternates: string[]
}

export const TOPICS_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A question a customer asks before buying. Under 65 characters.' },
          who_asks: { type: 'string', description: 'One short phrase.' },
          gist: { type: 'string', description: 'The answer in 25 words or fewer.' },
          service: { type: 'string', description: 'Exactly one of the listed services, or an empty string if none fits.' },
          signal: { type: 'string', description: 'Where this came from, in one short sentence. Name the research fact or question when one applies.' },
          keyword_primary: { type: 'string', description: 'Stock photo search phrase of 2 to 4 concrete words.' },
          keyword_alternates: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
        },
        required: ['title', 'who_asks', 'gist', 'service', 'signal', 'keyword_primary', 'keyword_alternates'],
      },
    },
  },
  required: ['topics'],
}

export const TOPIC_RULES = `Topic rules:
- Each topic is a real question a customer asks before buying.
- Mix: two early-stage questions ("What is...", "Do I need...", "When should I..."), two comparison or how-to questions ("How do I choose...", "How long does... take"), one ready-to-act question ("What happens when I hire...", "What should I ask before...").
- Each connects to a service the client sells and to a place or season where possible.
- Title under 65 characters, written as a plain question.
- No hype, no trend-chasing, no news-jacking. No claims, prices or numbers you cannot source from the approved facts.
- No two topics answer the same question, and none repeats a topic already on the list.
- Titles follow the writing rules: no dashes, no banned words.
- Image keywords describe a real photo someone could find: concrete things and places, no abstract words, no people's names.`

export type TopicsContext = {
  goal?: string | null
  services: string[]
  claims: string[] // included research facts about the client
  questions: string[] // open meeting questions, as hints for what customers wonder about
  existing: string[] // titles already on the list
  today: string
}

const bullets = (items: string[], max: number) => items.slice(0, max).map((s) => `- ${s}`).join('\n')

export function topicsInstruction(c: TopicsContext, feedback?: string[]): string {
  const parts = [
    `Suggest exactly five blog topics for this client. Today is ${c.today}.`,
    c.services.length ? `Services (pick one per topic, exactly as written):\n${bullets(c.services, 30)}` : 'No services are listed, so leave "service" empty.',
    c.goal ? `Their goal: ${c.goal}. Favour topics that lead towards it.` : '',
    c.claims.length ? `What research found on their site (checked facts):\n${bullets(c.claims, 40)}` : 'No research is available yet. Work from the business details and the season.',
    c.questions.length ? `Open questions from research (customers may wonder about these too):\n${bullets(c.questions, 10)}` : '',
    c.existing.length ? `Topics already on the list, do not repeat them:\n${bullets(c.existing, 40)}` : '',
    TOPIC_RULES,
  ]
  if (feedback?.length) parts.push(`Your last answer broke these rules. Fix them:\n${bullets(feedback, 12)}`)
  return parts.filter(Boolean).join('\n\n')
}

// Em and en dashes become commas, as in the research writer.
const undash = (t: string) => t.replace(/\s*\u2014\s*/g, ', ').replace(/(\d)\s*\u2013\s*(\d)/g, '$1 to $2').replace(/\s*\u2013\s*/g, ', ')

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

// Problems that need another pass: lint failures and titles that are too long or repeat an existing one.
export function topicProblems(topics: SuggestedTopic[], existing: string[], avoid: string[] = []): string[] {
  const out: string[] = []
  const seen = new Set(existing.map(norm))
  for (const t of topics) {
    for (const i of lintText(`${t.title} ${t.gist}`, { avoid, label: `"${t.title}"` })) if (i.level === 'fail') out.push(i.message)
    if (t.title.length > 65) out.push(`"${t.title}" is ${t.title.length} characters (limit 65)`)
    if (t.gist.split(/\s+/).length > 25) out.push(`"${t.title}": gist is over 25 words`)
    if (seen.has(norm(t.title))) out.push(`"${t.title}" repeats an existing topic`)
    seen.add(norm(t.title))
  }
  return out
}

// Final tidy before saving: trim, keep only listed services, drop repeats of existing titles.
export function cleanTopics(topics: SuggestedTopic[], services: string[], existing: string[]): SuggestedTopic[] {
  const seen = new Set(existing.map(norm))
  const byName = new Map(services.map((s) => [norm(s), s]))
  const out: SuggestedTopic[] = []
  for (const t of topics) {
    const title = (t.title ?? '').trim()
    if (!title || seen.has(norm(title))) continue
    seen.add(norm(title))
    out.push({
      title: undash(title),
      who_asks: (t.who_asks ?? '').trim(),
      gist: undash((t.gist ?? '').trim()),
      service: byName.get(norm(t.service ?? '')) ?? '',
      signal: (t.signal ?? '').trim(),
      keyword_primary: (t.keyword_primary ?? '').trim(),
      keyword_alternates: (t.keyword_alternates ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 2),
    })
  }
  return out
}

// What still blocks a topic after clean-up: banned or avoided words only. Length is a warning, not a reason to lose a topic.
export const blockingProblems = (t: SuggestedTopic, avoid: string[] = []) =>
  lintText(`${t.title} ${t.gist}`, { avoid }).filter((i) => i.level === 'fail').map((i) => i.message)
