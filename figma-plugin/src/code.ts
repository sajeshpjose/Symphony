// Symph covers: makes new cover frames from a client's templates, one set per post, with the cover text Symph wrote.
// The templates are only ever cloned. They are never edited, moved or replaced.
//
// Template frames are the top-level frames on the current page whose name ends in a size, for example
// "Instagram - 1080x1350". Inside each, text layers named Eyebrow, Heading and Description are filled in.
// The photo and the logo are left for you.

type Cover = { eyebrow: string; heading: string; description: string }
type PostInput = { id: string; title: string; date: string; cover: Cover; image?: Uint8Array | null }
type TemplateInfo = { id: string; name: string; w: number; h: number }

const POSTS_PAGE = 'Posts'
const SIZE_IN_NAME = /\b\d{3,4}x\d{3,4}\b/
const PAD = 80
const GAP = 80
const SECTION_GAP = 240

figma.showUI(__html__, { width: 420, height: 720, themeColors: true })

function templatesOnPage(): TemplateInfo[] {
  if (figma.currentPage.name === POSTS_PAGE) return []
  return figma.currentPage.children
    .filter((n): n is FrameNode => n.type === 'FRAME' && SIZE_IN_NAME.test(n.name))
    .map((n) => ({ id: n.id, name: n.name, w: Math.round(n.width), h: Math.round(n.height) }))
}

function sendTemplates() {
  figma.ui.postMessage({ type: 'templates', page: figma.currentPage.name, templates: templatesOnPage() })
}

async function setText(node: TextNode, text: string) {
  const fonts = node.getRangeAllFontNames(0, Math.max(node.characters.length, 1))
  await Promise.all(fonts.map((f) => figma.loadFontAsync(f)))
  node.characters = text
}

// Puts the chosen photo into the template's photo layer (a layer whose name starts with "Photo").
// FILL scales it to cover the frame and crops the rest; the fades and text stay on top.
function fillPhoto(frame: FrameNode, hash: string): string[] {
  const layer = frame.findOne((n) => 'fills' in n && /^photo/i.test(n.name)) as (SceneNode & MinimalFillsMixin) | null
  if (!layer) return [`${frame.name}: no layer named Photo, so the image was not placed`]
  layer.fills = [{ type: 'IMAGE', imageHash: hash, scaleMode: 'FILL' }]
  return []
}

// Fills the three text layers of a cloned template. Returns what was missing.
async function fillCover(frame: FrameNode, cover: Cover): Promise<string[]> {
  const missing: string[] = []
  const group = frame.findOne((n) => n.type === 'FRAME' && n.name === 'Text') as FrameNode | null
  // The text block is anchored to the bottom of the frame, so keep that gap when the line count changes.
  const bottomGap = group ? frame.height - (group.y + group.height) : 0
  const layers: [string, string][] = [
    ['Eyebrow', cover.eyebrow.toUpperCase()],
    ['Heading', cover.heading],
    ['Description', cover.description],
  ]
  for (const [name, value] of layers) {
    const node = frame.findOne((n) => n.type === 'TEXT' && n.name === name) as TextNode | null
    if (!node) { missing.push(`${frame.name}: no text layer named ${name}`); continue }
    await setText(node, value)
  }
  if (group) group.y = frame.height - bottomGap - group.height
  return missing
}

async function create(posts: PostInput[], templateIds: string[]) {
  const warnings: string[] = []
  const templates: FrameNode[] = []
  for (const id of templateIds) {
    const n = await figma.getNodeByIdAsync(id)
    if (n && n.type === 'FRAME') templates.push(n)
  }
  if (!templates.length) throw new Error('Pick at least one template')
  if (!posts.length) throw new Error('Pick at least one post')

  // 1. Clone every template for every post, and fill the text, while still on the templates page.
  const made: { post: PostInput; frames: FrameNode[] }[] = []
  for (const post of posts) {
    const frames: FrameNode[] = []
    const hash = post.image && post.image.length ? figma.createImage(post.image).hash : null
    for (const tpl of templates) {
      const copy = tpl.clone()
      copy.name = `${tpl.name} | ${post.title}`
      warnings.push(...(await fillCover(copy, post.cover)))
      if (hash) warnings.push(...fillPhoto(copy, hash))
      frames.push(copy)
    }
    made.push({ post, frames })
  }

  // 2. Move the copies into one section per post on the Posts page.
  let page = figma.root.children.find((p) => p.name === POSTS_PAGE)
  if (!page) {
    page = figma.createPage()
    page.name = POSTS_PAGE
  }
  await figma.setCurrentPageAsync(page)
  let y = page.children.length ? Math.max(...page.children.map((n) => n.y + n.height)) + SECTION_GAP : 0
  const sections: SectionNode[] = []
  for (const { post, frames } of made) {
    const section = figma.createSection()
    section.name = `${post.date} | ${post.title}`
    section.x = 0
    section.y = y
    let x = PAD
    let tallest = 0
    for (const f of frames) {
      section.appendChild(f)
      f.x = x
      f.y = PAD
      x += f.width + GAP
      tallest = Math.max(tallest, f.height)
    }
    section.resizeWithoutConstraints(x - GAP + PAD, tallest + PAD * 2)
    sections.push(section)
    y += section.height + SECTION_GAP
  }
  figma.currentPage.selection = sections
  figma.viewport.scrollAndZoomIntoView(sections)
  return { sections: sections.length, frames: made.reduce((n, m) => n + m.frames.length, 0), warnings }
}

figma.ui.onmessage = async (msg: { type: string; [k: string]: unknown }) => {
  try {
    if (msg.type === 'init') {
      const [address, token, clientId] = await Promise.all([
        figma.clientStorage.getAsync('address'),
        figma.clientStorage.getAsync('token'),
        figma.clientStorage.getAsync('clientId'),
      ])
      figma.ui.postMessage({ type: 'init', address: address ?? '', token: token ?? '', clientId: clientId ?? '' })
      sendTemplates()
    } else if (msg.type === 'save-settings') {
      await figma.clientStorage.setAsync('address', msg.address)
      await figma.clientStorage.setAsync('token', msg.token)
    } else if (msg.type === 'save-client') {
      await figma.clientStorage.setAsync('clientId', msg.clientId)
    } else if (msg.type === 'scan') {
      sendTemplates()
    } else if (msg.type === 'create') {
      const result = await create(msg.posts as PostInput[], msg.templateIds as string[])
      figma.ui.postMessage({ type: 'done', ...result })
      sendTemplates()
    }
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: (e as Error).message })
  }
}

figma.on('currentpagechange', sendTemplates)
