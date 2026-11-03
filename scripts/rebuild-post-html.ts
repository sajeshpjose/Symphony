// One-off utility: rebuilds body_html and faq for saved posts from their Markdown, with the current blog builder.
// Use it after the HTML template changes (for example the byline removal) so saved posts match new ones.
// Only body_html and faq change. The Markdown, checks, social copy and cover text are left alone.
//
//   npm run rebuild:html           shows what would change
//   npm run rebuild:html -- --apply   saves the changes
import { createClient } from '@supabase/supabase-js'
import { blogClientFrom, buildBlog } from '../packages/core/src/index'

const apply = process.argv.includes('--apply')
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (run through npm so .env is loaded)')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: posts, error } = await db.from('posts').select('id, client_id, title, status, body_md, body_html').not('body_md', 'is', null)
if (error) throw error

const clients = new Map<string, ReturnType<typeof blogClientFrom>>()
const clientFor = async (id: string) => {
  if (!clients.has(id)) {
    const [{ data: c }, { data: v }] = await Promise.all([
      db.from('clients').select('name, website, author_name, author_role, services, cta_text, cta_url, location').eq('id', id).single(),
      db.from('voice_profiles').select('spelling').eq('client_id', id).maybeSingle(),
    ])
    clients.set(id, blogClientFrom(c!, (v?.spelling ?? 'canadian') as 'canadian' | 'us' | 'uk'))
  }
  return clients.get(id)!
}

let changed = 0
let same = 0
const failed: string[] = []
for (const p of posts ?? []) {
  try {
    const built = buildBlog(p.body_md as string, await clientFor(p.client_id as string))
    if (built.html === p.body_html) { same++; continue }
    changed++
    console.log(`${apply ? 'rebuilt' : 'would rebuild'}: ${p.title ?? p.id}  (${p.status})`)
    if (apply) {
      const { error: e } = await db.from('posts').update({ body_html: built.html, faq: built.faq }).eq('id', p.id)
      if (e) throw e
    }
  } catch (e) {
    failed.push(`${p.title ?? p.id}: ${(e as Error).message}`)
  }
}
console.log(`\n${apply ? 'Rebuilt' : 'Would rebuild'} ${changed} post(s); ${same} already up to date; ${failed.length} could not be built.`)
failed.forEach((f) => console.log(`  failed: ${f}`))
if (!apply && changed) console.log('Run again with --apply to save.')
