import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildBlog, checkBlog, checkSocial, faqPairs, parseBlog } from './blog'

const assets = new URL('../../../skills/client-content-pack/assets/', import.meta.url)
const blog = readFileSync(new URL('example-blog.md', assets), 'utf8')
const posts = JSON.parse(readFileSync(new URL('example-posts.json', assets), 'utf8')) as Record<string, string>

const client = {
  name: 'Birch & Co. Landscaping',
  website: 'birchandco.example',
  language: 'en-CA',
  author_name: 'Mark Birch',
  author_role: 'Owner',
  services: [{ name: 'Lawn care', url: 'https://birchandco.example/lawn-care' }],
}

describe('buildBlog', () => {
  it('builds HTML with Article, FAQPage and Organization markup', () => {
    const built = buildBlog(blog, client)
    const types = (built.schema['@graph'] as { '@type': string }[]).map((n) => n['@type'])
    expect(types).toEqual(['Article', 'Organization', 'FAQPage'])
    expect(built.html).toContain('<h1>How do I prepare my lawn for winter in Toronto?</h1>')
    // No visible byline or updated line under the heading; the author stays in the markup only.
    expect(built.html).not.toContain('class="byline"')
    expect(built.html).not.toMatch(/Updated \d{4}/)
    expect(built.html).toContain('"jobTitle": "Owner"')
    expect(built.url).toBe('https://birchandco.example/blog/how-to-prepare-lawn-for-winter-toronto')
    expect(built.faq.length).toBeGreaterThanOrEqual(3)
  })

  it('uses the organisation as author when there is no author', () => {
    const built = buildBlog(blog, { ...client, author_name: null })
    const article = (built.schema['@graph'] as Record<string, unknown>[])[0]
    expect((article.author as { '@type': string })['@type']).toBe('Organization')
  })

  it('refuses a draft without front matter', () => {
    expect(() => buildBlog('Just text', client)).toThrow(/front matter/)
  })

  it('reads quick answers as question and answer pairs', () => {
    expect(faqPairs(parseBlog(blog).body)[0]).toMatchObject({ q: expect.stringMatching(/\?$/) })
  })
})

describe('checkBlog', () => {
  it('passes the example blog with no failures', () => {
    const { checks } = checkBlog(blog, { client })
    expect(checks.filter((c) => c.status === 'fail')).toEqual([])
  })

  it('fails on dashes and banned words', () => {
    const bad = blog.replace('Rake the leaves,', 'Rake the leaves — and leverage')
    const words = checkBlog(bad, { client }).checks.find((c) => c.id === 'words')!
    expect(words.status).toBe('fail')
    expect(words.note).toMatch(/em dash/)
    expect(words.note).toMatch(/leverage/)
  })

  it("fails on the client's own avoid words", () => {
    const words = checkBlog(blog, { client, avoid: ['aerate'] }).checks.find((c) => c.id === 'words')!
    expect(words.status).toBe('fail')
  })

  it('warns when a short answer is too long', () => {
    const long = blog.replace(/^(---[\s\S]*?---\s*\n\n)[^\n]+/, `$1${'word '.repeat(90)}`)
    expect(checkBlog(long, { client }).checks.find((c) => c.id === 'structure')!.note).toMatch(/short answer is 9\d words/)
  })
})

describe('checkSocial', () => {
  const social = Object.fromEntries(Object.entries(posts).map(([k, text]) => [k, { text }]))

  it('passes the example posts', () => {
    expect(checkSocial(social, {}).checks[0].status).not.toBe('fail')
  })

  it('fails when a post is over its limit', () => {
    const tooLong = { ...social, instagram: { text: 'x '.repeat(100) + 'Link in bio.' } }
    const res = checkSocial(tooLong, {})
    expect(res.checks[0].status).toBe('fail')
    expect(res.checks[0].note).toMatch(/instagram: \d+ characters/)
  })

  it('only checks the channels a client uses', () => {
    const res = checkSocial({ linkedin: social.linkedin }, { channels: ['linkedin'] })
    expect(res.checks[0].status).not.toBe('fail')
  })
})
