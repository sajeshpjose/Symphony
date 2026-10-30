import { describe, expect, it } from 'vitest'
import { cleanTopics, topicProblems, topicsInstruction, type SuggestedTopic } from './topics'

const topic = (over: Partial<SuggestedTopic> = {}): SuggestedTopic => ({
  title: 'When should I stop mowing in the fall?',
  who_asks: 'Homeowner',
  gist: 'Stop when the grass stops growing, usually late October.',
  service: 'lawn care',
  signal: 'Seasonal',
  keyword_primary: 'autumn lawn mowing',
  keyword_alternates: ['fallen leaves lawn', 'lawn mower garden'],
  ...over,
})

describe('topicProblems', () => {
  it('accepts a clean topic', () => {
    expect(topicProblems([topic()], [])).toEqual([])
  })
  it('flags dashes, banned words, long titles and repeats', () => {
    const p = topicProblems(
      [topic({ title: 'Why a seamless lawn — and how to get one in Toronto this fall season?' }), topic({ title: 'when should I stop mowing in the fall' })],
      ['When should I stop mowing in the fall?'],
    )
    expect(p.join('|')).toMatch(/em dash/)
    expect(p.join('|')).toMatch(/seamless/)
    expect(p.join('|')).toMatch(/limit 65/)
    expect(p.join('|')).toMatch(/repeats an existing topic/)
  })
  it("flags the client's avoid words", () => {
    expect(topicProblems([topic({ gist: 'Cheap and quick.' })], [], ['cheap']).length).toBeGreaterThan(0)
  })
})

describe('cleanTopics', () => {
  it('keeps only listed services and drops repeats', () => {
    const out = cleanTopics([topic({ service: 'Lawn Care' }), topic({ title: 'Do I need snow removal?', service: 'Plumbing' }), topic()], ['Lawn care'], [])
    expect(out.map((t) => t.service)).toEqual(['Lawn care', ''])
    expect(out).toHaveLength(2)
  })
})

describe('topicsInstruction', () => {
  it('lists existing topics and feedback', () => {
    const text = topicsInstruction({ services: ['Lawn care'], claims: ['Open since 2010'], questions: [], existing: ['Old topic?'], today: '2026-10-31' }, ['too long'])
    expect(text).toContain('Old topic?')
    expect(text).toContain('Open since 2010')
    expect(text).toContain('too long')
    expect(text).toContain('Services (pick one per topic')
  })
  it('works without research or services', () => {
    const text = topicsInstruction({ services: [], claims: [], questions: [], existing: [], today: '2026-10-31' })
    expect(text).toContain('No research is available')
    expect(text).toContain('leave "service" empty')
  })
})
