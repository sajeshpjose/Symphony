// Prompts for research runs, condensed from skills/client-intelligence-report
// (SKILL.md, references/evidence-rules.md, report-sections.md, question-bank.md).
import { HOUSE_RULES, QUESTION_TOPICS, SECTION_TITLES } from '../../packages/core/src/index'

export const RESEARCH_SYSTEM = `You research a business for a digital marketing agency. The agency hands the report to the client, so a wrong or hedged statement damages its credibility. The report contains only what can be defended; everything uncertain becomes a question for the first client meeting.

Evidence types:
- stated: the business says it on its own website. Needs an exact quote from the page.
- observed_absence: the pages read do not mention something, and you read the pages where it would appear (say which in the note). Worded neutrally: "The pages reviewed do not mention X." Never implies the business does not offer it.
- inferred: your judgment from patterns or marketing knowledge. Never goes in the report; it becomes a question.
- single_external: one third-party source only. Never goes in the report; it becomes a question.

Quotes: copy under 15 words exactly as they appear in the page text you were given, including spelling. Never paraphrase inside a quote. If you cannot find exact words that support a claim, the claim is inferred.

Never: estimate revenue, customer counts, traffic or market share; name individual customers or private people; judge competitor quality; use statistics without a named source and date.

${HOUSE_RULES.split("\n").slice(0, 5).join("\n")}`

export const CLAIMS_INSTRUCTION = (args: { name: string; url: string; notes: string }) => `Business: ${args.name} (${args.url})
${args.notes}

Read every page above and record each useful fact as a claim. Cover: what the business is and does, where it operates, how long it has operated, services or products and how each is described, displayed pricing, guarantees, certifications, audiences it names, testimonials and case studies (themes only, no names), mission, values or goals it states, how to contact or book, and content activity (blog, news, dates).

Pages whose url starts with file:// are the client's own data exports (GA4, Search Console, Meta Ads, reviews, social snapshot). Figures from them are "stated" claims; quote the figure with its label exactly as written in the text copy, for example "clicks total 419". Use sections search, analytics, ads, reviews and social for them. Rules for exports:
- If a GA4 copy says "tracking warning true", GA4 is not capturing traffic: put no GA4 traffic or lead figures in claims marked included; record one included claim that Google clicks are more than three times GA4 users (quote both figures) in section opportunities. Search Console figures are still fine.
- Meta Ads results are what Meta reports: word them "Meta reports 7 website leads". Never reconcile them with GA4.
- Review themes: only when the export has 10 or more reviews with text and at least 30 percent of them express the theme. Record the count in the note ("7 of 18 reviews mention punctuality"), word the claim as a proportion, quote a short phrase from one of those reviews, never name a reviewer. Otherwise the theme is a question.
- City or audience figures under 50 users are not claims.
- Engagement rate only when 10 posts were counted; "inactive" only when the last post is over 90 days old.

Also record observed absences that matter for marketing (for example no pricing shown, no testimonials, no service area named), only where you read the pages where the item would appear.

For each claim give the section key (${Object.keys(SECTION_TITLES).join(', ')}), plain claim text, the quote, the page ref (P01...), the evidence type, and a decision: "included" if stated or observed_absence, "question" if inferred. Aim for 25 to 60 claims. Keep each claim to one fact.

Then describe the business for a competitor search: its main services (short names) and the area it serves, exactly as the site states them.`

export const COMPETITOR_SEARCH_INSTRUCTION = (args: { name: string; url: string; services: string[]; area: string; known: string[] }) => `Find direct competitors of ${args.name} (${args.url}).
Services: ${args.services.join(', ') || 'see the website'}
Area served: ${args.area || 'not stated'}
${args.known.length ? `The agency named these competitors (include them first, find their websites): ${args.known.join('; ')}` : ''}

Search the web (at most 4 searches) for businesses that offer at least two of the same services in an overlapping area. Prefer independent local or regional businesses over directories, marketplaces and national aggregators. Return up to ${args.known.length ? Math.max(5, args.known.length) : 5} candidates with the homepage address exactly as it appeared in the search results. Do not guess addresses. Then call the competitor_candidates tool.`

export const COMPETITOR_FACTS_INSTRUCTION = (args: { name: string; services: string[]; area: string; competitors: { name: string; named: boolean }[] }) => `The client is ${args.name}. Its services: ${args.services.join(', ')}. Its area: ${args.area || 'not stated'}.

Above are pages from these businesses' own websites: ${args.competitors.map((c) => `${c.name}${c.named ? ' (named by the agency)' : ''}`).join(', ')}.

For each business:
1. List which of the client's services it also lists, and the area it states it serves.
2. Decide if it qualifies as a competitor: at least two listed services overlap AND its stated area overlaps the client's. Businesses named by the agency always qualify.
3. Record observable facts as claims, each with an exact quote under 15 words and the page ref: services that overlap, area served, displayed pricing, guarantees, certifications, content activity. Section "competitors". Evidence "stated". Decision "included" if the business qualifies, otherwise "question".
Never state strengths, weaknesses, undisplayed prices, size or revenue.`

export const WRITE_INSTRUCTION = (args: { name: string; claimsJson: string; competitorSummary: string; reviewSample?: string; part: 'report' | 'questions' }) => `${
  args.part === 'report'
    ? `Write the version 1 report for ${args.name} from the claims below. Return only the report sections; the meeting questions are written in a separate step.`
    : `Write the internal list of questions for the first meeting with ${args.name}, from the claims below. Return only the questions; the report is written in a separate step.`
}

Claims (only "included" ones may be cited in the report; "question" ones feed the question list):
${args.claimsJson}

Competitors checked:
${args.competitorSummary || 'none'}
${args.reviewSample ? `\nGoogle review samples (at most five per business, picked by Google). Never cite these in the report and never quote or name reviewers; use them only for meeting questions about what customers raise:\n${args.reviewSample}` : ''}

Report sections, in order; include a section only when it has enough included claims, and leave it out otherwise:
- summary (Executive summary): three to five plain statements on who the client is, what it offers and where. Needs at least three included claims across other sections.
- overview (Business overview): open with a "facts" block of two to four short facts (a year, a number of services, a place) when available, then one paragraph with "lead": true.
- offerings (Services and offerings): a table with columns Service, What the site says.
- aspirations (Stated aspirations and positioning): only mission, vision, values or goals the client states.
- audiences (Audiences the business addresses): segments named on the site or shown by testimonials or service pages. No personas.
- customers (What customers say): testimonial themes stated on the site, paraphrased, no names.
- reviews (Reputation): a table of Google rating and review count for the client and qualifying competitors, from the Google Business Profile claims. Themes only from a reviews export that meets the 30 percent rule.
- search (Search demand): from Search Console figures: clicks and impressions, branded share with both counts, top non-brand queries, page one or two opportunities.
- analytics (Website performance): GA4 figures, only when no tracking warning was raised.
- ads (Paid media): spend, reach, impressions, frequency, results and cost per result by campaign or ad set, as Meta reports them.
- social (Social presence): followers, posting cadence, interactions and days since last post per platform, client and competitors side by side.
- competitors (Competitive landscape): a table comparing the client and at least two qualifying competitors on observable attributes. Omit if fewer than two qualify.
- standout (Where the business stands out today): differences seen by comparing observed facts, worded "among those reviewed".
- opportunities (Opportunities): each one a verified gap, stated neutrally, citing the claims that create it. An observed absence alone is never enough; pair it with a competitor fact or a stated fact.
- actions (Action points): only when there are three or more opportunities. A table with columns Action, Why now, Evidence. Each action says what we would do (publish, fix, add, test), never what will result.
- content (Content starter themes): five to eight themes, each tied to a verified offering or audience.

Block rules:
- Block types: paragraph, callout, bullets, table, facts, chart. Every paragraph, callout, bullet, table cell, fact and chart point cites the claim ids it rests on.
- Use one chart where a comparison reads better as a picture: review counts across competitors (kind "bar", the client's bar "highlight": true), sessions or key events by channel ("column", up to three series), spend or results by ad set ("bar"), weekly or monthly trends ("line"). Give each chart a short title and a caption naming the source and period, and cite the claims behind the title and caption in the chart's claim_ids. Values are plain numbers exactly as the claims state them. No chart without numbers from the claims.
- A callout has a short title in a few words (for example "The clearest finding" or "In the firm's words") and one or two sentences; at most one per section.
- A block with no claims sets "structural": true and must contain no numbers.
- Every number in a block must appear in the cited claims' text or quote.
- State facts plainly. Never use likely, probably, may, might, appears to, seems, perhaps, possibly.
- Lead each section with the point, then the evidence. Do not mention questions, evidence levels, the ledger or confidence.
- No em dashes or en dashes.

Questions: 15 to 30, grouped by topic (${QUESTION_TOPICS.join('; ')}). Each has the question, the trigger (what made you ask), what the site says now, and priority "must" (changes the strategy or unlocks a section: goals, decision makers, competitors, what counts as a lead) or "nice". Turn every "question" claim and every important gap into a question specific to this client. Ask about competitors that did not qualify ("Do you compete with X?"). Must-asks first within each topic.`

// --- tool schemas -------------------------------------------------------------

const claimItem = {
  type: 'object',
  properties: {
    section: { type: 'string' },
    text: { type: 'string' },
    quote: { type: 'string', description: 'Exact words from the page, under 15 words. Empty for observed_absence.' },
    page_ref: { type: 'string', description: 'P01, P02 ... Empty for observed_absence.' },
    evidence: { type: 'string', enum: ['stated', 'observed_absence', 'inferred'] },
    decision: { type: 'string', enum: ['included', 'question'] },
    note: { type: 'string' },
  },
  required: ['section', 'text', 'quote', 'page_ref', 'evidence', 'decision'],
}

export const CLAIMS_SCHEMA = {
  type: 'object',
  properties: {
    business_name: { type: 'string' },
    claims: { type: 'array', items: claimItem },
    services: { type: 'array', items: { type: 'string' }, description: 'Main services, short names' },
    area: { type: 'string', description: 'Area served as the site states it, or empty' },
  },
  required: ['business_name', 'claims', 'services', 'area'],
}

export const CANDIDATES_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          named: { type: 'boolean', description: 'True if the agency named this competitor' },
          why: { type: 'string' },
        },
        required: ['name', 'url', 'named'],
      },
    },
  },
  required: ['candidates'],
}

export const COMPETITOR_FACTS_SCHEMA = {
  type: 'object',
  properties: {
    competitors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          overlapping_services: { type: 'array', items: { type: 'string' } },
          area: { type: 'string' },
          qualifies: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['name', 'overlapping_services', 'area', 'qualifies'],
      },
    },
    claims: { type: 'array', items: { ...claimItem, properties: { ...claimItem.properties, competitor: { type: 'string' } }, required: [...claimItem.required, 'competitor'] } },
  },
  required: ['competitors', 'claims'],
}

const cited = {
  type: 'object',
  properties: { text: { type: 'string' }, claim_ids: { type: 'array', items: { type: 'string' } }, structural: { type: 'boolean' } },
  required: ['text', 'claim_ids'],
}

const WRITE_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', enum: Object.keys(SECTION_TITLES) },
          title: { type: 'string' },
          blocks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['paragraph', 'callout', 'bullets', 'table', 'facts', 'chart'] },
                kind: { type: 'string', enum: ['bar', 'column', 'line'], description: 'chart only' },
                unit: { type: 'string', description: 'chart only, appended to values, usually empty' },
                caption: { type: 'string', description: 'chart only: source and period' },
                series: {
                  type: 'array',
                  description: 'chart only, for column and line charts with more than one series',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      items: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' }, claim_ids: { type: 'array', items: { type: 'string' } }, highlight: { type: 'boolean' } }, required: ['label', 'value', 'claim_ids'] } },
                    },
                    required: ['name', 'items'],
                  },
                },
                title: { type: 'string' },
                text: { type: 'string' },
                lead: { type: 'boolean' },
                structural: { type: 'boolean' },
                claim_ids: { type: 'array', items: { type: 'string' } },
                items: {
                  type: 'array',
                  description: 'bullets: {text, claim_ids}. facts: {label, value (text), claim_ids}. one-series chart: {label, value (number), claim_ids, highlight}.',
                  items: {
                    type: 'object',
                    properties: {
                      text: { type: 'string' },
                      label: { type: 'string' },
                      value: { type: ['string', 'number'] },
                      claim_ids: { type: 'array', items: { type: 'string' } },
                      structural: { type: 'boolean' },
                      highlight: { type: 'boolean' },
                    },
                    required: ['claim_ids'],
                  },
                },
                headers: { type: 'array', items: { type: 'string' } },
                rows: { type: 'array', items: { type: 'array', items: cited } },
              },
              required: ['type'],
            },
          },
        },
        required: ['key', 'title', 'blocks'],
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: QUESTION_TOPICS },
          question: { type: 'string' },
          trigger: { type: 'string' },
          site_says: { type: 'string' },
          priority: { type: 'string', enum: ['must', 'nice'] },
          claim_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['topic', 'question', 'trigger', 'site_says', 'priority'],
      },
    },
  },
  required: ['sections', 'questions'],
}

export const REPORT_SCHEMA = { type: 'object', properties: { sections: WRITE_SCHEMA.properties.sections }, required: ['sections'] }
export const QUESTIONS_SCHEMA = { type: 'object', properties: { questions: WRITE_SCHEMA.properties.questions }, required: ['questions'] }
