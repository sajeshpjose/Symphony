// Turns a client's set-up into the brief every Claude call starts with.
// The brief is identical for every call about one client, so it is sent as a cached system block.

export type ClientInfo = {
  name: string
  website?: string | null
  industry?: string | null
  location?: string | null
  sells?: string | null
  audience?: string | null
  goal?: string | null
  success_measure?: string | null
}

export type VoiceProfile = {
  formality: number // 0 casual … 100 formal
  humor: number // 0 serious … 100 playful
  sentence_length: number // 0 short … 100 long
  traits: string[]
  point_of_view: 'we' | 'i' | 'you' | 'neutral'
  spelling: 'canadian' | 'us' | 'uk'
  emoji: 'none' | 'light' | 'often'
  hashtags: 'none' | '1-2' | '3-5'
  words_use: string[]
  words_avoid: string[]
  topics_avoid: string[]
  claims_never: string[]
  disclaimer?: string | null
  regulated: boolean
  summary?: string | null
}

export type VoiceExample = { kind: 'loved' | 'disliked'; channel?: string | null; title?: string | null; body: string; reason?: string | null }
export type Fact = { text: string; type: string; status: 'approved' | 'needs_proof' | 'consent_needed' }

export const DEFAULT_VOICE: VoiceProfile = {
  formality: 40,
  humor: 30,
  sentence_length: 35,
  traits: [],
  point_of_view: 'we',
  spelling: 'canadian',
  emoji: 'light',
  hashtags: '1-2',
  words_use: [],
  words_avoid: [],
  topics_avoid: [],
  claims_never: [],
  disclaimer: null,
  regulated: false,
  summary: null,
}

export const VOICE_TRAITS = ['Warm', 'Practical', 'Down-to-earth', 'Calm', 'Bold', 'Expert', 'Witty', 'Inspiring', 'Friendly']

const scale = (v: number, low: string, mid: string, high: string) => (v < 34 ? low : v < 67 ? mid : high)

export const formalityLabel = (v: number) => scale(v, 'Casual', 'Friendly, relaxed', 'Formal')
export const humorLabel = (v: number) => scale(v, 'Serious', 'A touch of humour', 'Playful')
export const lengthLabel = (v: number) => scale(v, 'Short and punchy', 'Mostly short', 'Longer and detailed')

const POV: Record<VoiceProfile['point_of_view'], string> = {
  we: 'Speak as "we" (the business).',
  i: 'Speak as "I" (the owner).',
  you: 'Address the reader as "you"; keep the business in the background.',
  neutral: 'Neutral voice; no "we" or "I".',
}
const SPELLING: Record<VoiceProfile['spelling'], string> = { canadian: 'Canadian spelling (colour, centre, cheque).', us: 'US spelling.', uk: 'UK spelling.' }

const list = (items: string[]) => items.filter((s) => s.trim()).map((s) => `- ${s.trim()}`).join('\n')

// Shared writing rules from the content skill (skills/client-content-pack).
export const HOUSE_RULES = `Writing rules for everything you write:
- Plain language a busy reader understands on first read. Short sentences, about 12 words on average.
- Never use em dashes or en dashes. Use a full stop or a comma instead.
- Avoid filler and AI-sounding words such as delve, leverage, unlock, seamless, robust, game-changer, journey, navigate, crucial, comprehensive, moreover, furthermore.
- No "not just X but Y" constructions. No exclamation marks in blog posts.
- Only state prices, numbers, credentials and quotes that appear in the approved facts. If a fact is missing, write around it.`

export function voiceBrief(client: ClientInfo, v: VoiceProfile, examples: VoiceExample[] = [], facts: Fact[] = []): string {
  const parts: string[] = []
  parts.push(`You write content for ${client.name}${client.website ? ` (${client.website})` : ''}.`)
  const about = [
    client.industry && `Industry: ${client.industry}`,
    client.location && `Location and service area: ${client.location}`,
    client.sells && `What they sell: ${client.sells}`,
    client.audience && `Who they write for: ${client.audience}`,
    client.goal && `Goal: ${client.goal}${client.success_measure ? ` (judged by: ${client.success_measure})` : ''}`,
  ].filter(Boolean)
  if (about.length) parts.push(about.join('\n'))

  parts.push(
    [
      'Voice:',
      `- Formality: ${formalityLabel(v.formality)}. Humour: ${humorLabel(v.humor)}. Sentences: ${lengthLabel(v.sentence_length)}.`,
      v.traits.length ? `- Traits: ${v.traits.join(', ')}.` : '',
      `- ${POV[v.point_of_view]}`,
      `- ${SPELLING[v.spelling]}`,
      `- Emoji: ${v.emoji}. Hashtags on social posts: ${v.hashtags}.`,
    ]
      .filter(Boolean)
      .join('\n'),
  )
  if (v.summary) parts.push(`How this client sounds:\n${v.summary}`)
  if (v.words_use.length) parts.push(`Words to use where natural:\n${list(v.words_use)}`)
  if (v.words_avoid.length) parts.push(`Never use these words:\n${list(v.words_avoid)}`)
  if (v.topics_avoid.length) parts.push(`Topics to avoid:\n${list(v.topics_avoid)}`)
  if (v.claims_never.length) parts.push(`Claims never to make:\n${list(v.claims_never)}`)
  if (v.disclaimer) parts.push(`Required disclaimer at the end of every blog post:\n${v.disclaimer}`)
  if (v.regulated) parts.push('This is a regulated industry. Be conservative. Do not give advice that needs a licensed professional.')

  const approved = facts.filter((f) => f.status === 'approved')
  if (approved.length) parts.push(`Approved facts (the only prices, numbers, credentials and quotes you may state):\n${list(approved.map((f) => f.text))}`)

  const loved = examples.filter((e) => e.kind === 'loved')
  const disliked = examples.filter((e) => e.kind === 'disliked')
  if (loved.length) parts.push(`Posts the client loved (match this voice):\n${loved.map((e) => `---\n${e.body}`).join('\n')}`)
  if (disliked.length)
    parts.push(`A post the client disliked (avoid this):\n${disliked.map((e) => `---\n${e.body}${e.reason ? `\nWhy: ${e.reason}` : ''}`).join('\n')}`)

  parts.push(HOUSE_RULES)
  return parts.join('\n\n')
}
