import { blogClientFrom, CHANNEL_LABELS, checkPost, COVER_LIMITS, POST_LIMITS, trimCover, type Channel, type CoverText, type Social } from '@symph/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button, Card, Chip, Input, Note, PageHeader, Textarea } from '../components/ui'
import { api } from '../lib/api'
import { useClientBundle } from '../lib/client'
import { POST_STATUS, usePost } from '../lib/posts'
import { supabase } from '../lib/supabase'

const photoLinks = (kw: string) => [
  ['Unsplash', `https://unsplash.com/s/photos/${encodeURIComponent(kw)}`],
  ['Pexels', `https://www.pexels.com/search/${encodeURIComponent(kw)}/`],
]

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />} {done ? 'Copied' : label}
    </Button>
  )
}

// Review one post: read it, edit the Markdown or the social copy, re-run the checks, mark it reviewed.
export function PostPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: post, error } = usePost(id)
  const bundle = useClientBundle(post?.client_id)
  const [md, setMd] = useState('')
  const [social, setSocial] = useState<Social>({})
  const [cover, setCover] = useState<CoverText>({ eyebrow: '', heading: '', description: '' })
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!post) return
    setMd(post.body_md ?? '')
    setSocial(post.social ?? {})
    setCover(trimCover(post.cover))
  }, [post?.id, post?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const channels = (bundle.data?.client.social_channels ?? Object.keys(post?.social ?? {})) as Channel[]
  const dirty = !!post && (md !== (post.body_md ?? '') || JSON.stringify(social) !== JSON.stringify(post.social ?? {}) || JSON.stringify(cover) !== JSON.stringify(trimCover(post.cover)))

  const save = useMutation({
    mutationFn: async (reviewed?: boolean) => {
      if (!post || !bundle.data) throw new Error('Still loading')
      const { client, voice } = bundle.data
      const checked = checkPost(
        { blog_md: md, social, image_keywords: post.image_keywords ?? [], cover: cover.heading || cover.eyebrow || cover.description ? cover : undefined },
        { client: blogClientFrom(client, voice?.spelling ?? 'canadian'), avoid: voice?.words_avoid ?? [], channels },
      )
      const { error } = await supabase
        .from('posts')
        .update({
          title: checked.title || post.title,
          body_md: md,
          body_html: checked.body_html,
          faq: checked.faq,
          checks: checked.checks,
          social,
          cover,
          status: reviewed ? 'reviewed' : post.status === 'reviewed' ? 'to_review' : post.status,
          reviewed_at: reviewed ? new Date().toISOString() : null,
        })
        .eq('id', post.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', id] })
      qc.invalidateQueries({ queryKey: ['posts'] })
      setEditing(false)
    },
  })

  const suggestCover = useMutation({
    mutationFn: () => api<{ cover: CoverText }>('cover-suggest', { postId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', id] })
      qc.invalidateQueries({ queryKey: ['posts'] })
    },
  })

  if (error) return <Note tone="bad">{(error as Error).message}</Note>
  if (!post) return null
  const [statusLabel, statusTone] = POST_STATUS[post.status]
  const fails = (post.checks ?? []).filter((c) => c.status === 'fail').length
  const download = () => {
    const url = URL.createObjectURL(new Blob([post.body_html ?? ''], { type: 'text/html' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${(post.title ?? 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.html` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        crumb={<Link to={`/content?client=${post.client_id}`}>Content  /  {post.clients?.name}</Link>}
        title={post.title ?? 'Untitled'}
        subtitle={<Chip tone={statusTone}>{statusLabel}</Chip>}
        actions={
          <>
            <Button onClick={() => (editing ? setEditing(false) : setEditing(true))}>{editing ? 'Preview' : 'Edit Markdown'}</Button>
            <Button loading={save.isPending && !save.variables} disabled={!dirty} onClick={() => save.mutate(false)}>Save and re-check</Button>
            <Button variant="primary" loading={save.isPending && !!save.variables} disabled={fails > 0 || dirty} title={fails ? 'Fix the failed checks first' : dirty ? 'Save first' : ''} onClick={() => save.mutate(true)}>
              Mark reviewed
            </Button>
          </>
        }
      />
      {save.error && <div className="mb-4"><Note tone="bad">{(save.error as Error).message}</Note></div>}
      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="flex flex-col gap-6">
          <Card
            title="Blog post"
            action={<span className="flex gap-2"><CopyButton text={md} label="Copy Markdown" /><CopyButton text={post.body_html ?? ''} label="Copy HTML" /><Button type="button" onClick={download}><Download className="size-4" /> HTML</Button></span>}
          >
            {editing ? (
              <Textarea value={md} onChange={(e) => setMd(e.target.value)} className="min-h-[560px] font-mono text-[13px]" spellCheck />
            ) : (
              <iframe title="Preview" srcDoc={post.body_html ?? ''} className="h-[640px] w-full rounded-md border border-line bg-white" />
            )}
          </Card>
          <Card
            title="Cover text"
            subtitle="Three short lines for the social image. The Figma plugin puts them on the client's templates."
            action={<Button type="button" loading={suggestCover.isPending} disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => suggestCover.mutate()}>{post.cover?.heading ? 'Write again' : 'Write cover text'}</Button>}
          >
            {suggestCover.error && <div className="mb-3"><Note tone="bad">{(suggestCover.error as Error).message}</Note></div>}
            <div className="flex flex-col gap-3">
              {(['eyebrow', 'heading', 'description'] as const).map((k) => (
                <label key={k} className="block text-xs font-medium text-fg-2">
                  <span className="flex items-center justify-between capitalize">
                    {k}
                    <span className={cover[k].length > COVER_LIMITS[k] ? 'text-bad' : 'text-fg-3'}>{cover[k].length} of {COVER_LIMITS[k]}</span>
                  </span>
                  <Input className="mt-1.5 text-sm font-normal text-fg" value={cover[k]} onChange={(e) => setCover({ ...cover, [k]: e.target.value })} />
                </label>
              ))}
            </div>
          </Card>
          <Card title="Social copy" subtitle="{link} is replaced with the post link when you publish">
            <div className="flex flex-col gap-4">
              {channels.map((ch) => {
                const p = social[ch] ?? { text: '', hashtags: [] }
                const len = (p.text ?? '').replace(/\{link\}/g, '').replace(/\s+/g, ' ').trim().length
                const full = [p.text, ...(p.hashtags ?? []).map((h) => (h.startsWith('#') ? h : `#${h}`))].join(' ')
                return (
                  <div key={ch}>
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-fg-2">
                      {CHANNEL_LABELS[ch]}
                      <span className={len > POST_LIMITS[ch] ? 'text-bad' : 'text-fg-3'}>{len} of {POST_LIMITS[ch]}</span>
                      <span className="ml-auto"><CopyButton text={full.trim()} label="Copy" /></span>
                    </div>
                    <Textarea value={p.text} className="min-h-16" onChange={(e) => setSocial({ ...social, [ch]: { ...p, text: e.target.value } })} />
                    {!!p.hashtags?.length && <div className="mt-1 text-xs text-fg-3">{p.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</div>}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card title="Checks" subtitle="Same rules as the writing guide">
            <ul className="flex flex-col gap-2.5">
              {(post.checks ?? []).map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Chip tone={c.status === 'pass' ? 'ok' : c.status === 'warn' ? 'warn' : 'bad'}>{c.status === 'pass' ? 'Passed' : c.status === 'warn' ? 'Check' : 'Fix'}</Chip>
                    <span className="font-medium">{c.label}</span>
                  </div>
                  {c.note && <p className="mt-1 text-xs text-fg-2">{c.note}</p>}
                </li>
              ))}
            </ul>
            {dirty && <p className="mt-3 text-xs text-fg-3">Edited. Save to re-run the checks.</p>}
          </Card>
          <Card title="Photo search" subtitle="You choose the photo. Check the licence and attribution.">
            <ul className="flex flex-col gap-2.5 text-sm">
              {(post.image_keywords ?? []).map((k) => (
                <li key={k.phrase}>
                  <div className="font-medium">{k.phrase}</div>
                  <div className="flex items-center gap-3 text-xs text-fg-2">
                    {k.why && <span className="flex-1">{k.why}</span>}
                    {photoLinks(k.phrase).map(([name, href]) => <a key={name} href={href} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{name}</a>)}
                  </div>
                </li>
              ))}
            </ul>
            {post.image_avoid && <p className="mt-3 text-xs text-fg-3">Avoid: {post.image_avoid}</p>}
          </Card>
        </div>
      </div>
    </>
  )
}
