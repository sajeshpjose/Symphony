import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkPost, hasFailures, postInstruction, postSchema, problemsFrom, type PostResult } from './posts'

const assets = new URL('../../../skills/client-content-pack/assets/', import.meta.url)
const blog = readFileSync(new URL('example-blog.md', assets), 'utf8')
const posts = JSON.parse(readFileSync(new URL('example-posts.json', assets), 'utf8')) as Record<string, string>
const client = { name: 'Birch & Co. Landscaping', website: 'birchandco.example', author_name: 'Mark Birch', services: [{ name: 'Lawn care', url: 'https://birchandco.example/lawn-care' }] }
const channels = ['facebook', 'linkedin', 'instagram'] as const
const good: PostResult = {
  blog_md: blog,
  social: Object.fromEntries(Object.entries(posts).map(([k, text]) => [k, { text, hashtags: [] }])),
  image_keywords: [],
}

describe('checkPost', () => {
  it('builds the page and has no failures for the example', () => {
    const r = checkPost(good, { client, channels: [...channels] })
    expect(hasFailures(r.checks)).toBe(false)
    expect(r.body_html).toContain('application/ld+json')
    expect(r.title).toMatch(/lawn for winter/)
  })
  it('reports a build failure without throwing', () => {
    const r = checkPost({ ...good, blog_md: 'no front matter' }, { client, channels: [...channels] })
    expect(r.checks[0]).toMatchObject({ id: 'build', status: 'fail' })
    expect(problemsFrom(r.checks).join()).toMatch(/Page build/)
  })
  it('fails a social post that is over the limit', () => {
    const r = checkPost({ ...good, social: { ...good.social, instagram: { text: 'x '.repeat(100), hashtags: [] } } }, { client, channels: [...channels] })
    expect(hasFailures(r.checks)).toBe(true)
  })
})

describe('postInstruction', () => {
  const ctx = { topic: { title: 'When should I stop mowing?', service: 'Lawn care' }, today: '2026-10-31', channels: [...channels], voice: { hashtags: '1-2' as const, emoji: 'light' as const }, client: { ...client, cta_text: 'Book a free quote', cta_url: null } }
  it('only offers links that exist', () => {
    const t = postInstruction(ctx)
    expect(t).toContain('https://birchandco.example/lawn-care')
    expect(t).toContain('no link given')
  })
  it('says so when no links exist', () => {
    expect(postInstruction({ ...ctx, client: { name: 'X' }, topic: { title: 'Q?' } })).toContain('No links are given')
  })
  it('includes the failures on a retry', () => {
    expect(postInstruction(ctx, { previous: good, problems: ['too long'] })).toContain('too long')
  })
  it('limits the schema to the client channels', () => {
    expect(Object.keys((postSchema(['linkedin']).properties.social as { properties: object }).properties)).toEqual(['linkedin'])
  })
})

describe('cover text', () => {
  const cover = { eyebrow: 'Fall lawn care', heading: 'Is it too late to feed?', description: 'Late October is the last good window.' }
  it('passes short clean cover text', () => {
    const r = checkPost({ ...good, cover }, { client, channels: [...channels] })
    expect(r.checks.find((c) => c.id === 'cover')?.status).toBe('pass')
  })
  it('fails long, dashed or hashtagged cover text', () => {
    const r = checkPost({ ...good, cover: { eyebrow: 'x'.repeat(30), heading: 'Feed — now #lawn', description: '' } }, { client, channels: [...channels] })
    const c = r.checks.find((x) => x.id === 'cover')!
    expect(c.status).toBe('fail')
    expect(c.note).toMatch(/eyebrow is 30 characters/)
    expect(c.note).toMatch(/description is missing/)
    expect(c.note).toMatch(/em dash/)
    expect(c.note).toMatch(/hashtags/)
  })
  it('is skipped when there is no cover yet', () => {
    expect(checkPost(good, { client, channels: [...channels] }).checks.find((c) => c.id === 'cover')).toBeUndefined()
  })
})
