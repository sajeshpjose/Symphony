---
name: client-content-pack
description: Create a client's content pack. First five blog topics, then for each topic a simple answer-first blog post built for answer engines and AI agents, three very short social posts (Facebook, LinkedIn, Instagram), minimal creatives (eyebrow, heading, description and the client logo) rendered on the photo the user chooses, and stock-photo search keywords. Use whenever the user asks for blog topics, content ideas, blog posts, social media posts, social creatives, a weekly or monthly content pack, or "content for [client]", even if they only name one of these. Never creates images; the user picks them.
---

# Client Content Pack

Turns a client profile into five blog topics, then into the finished pieces for each topic: one blog post, three short social posts, three creatives, and image search keywords. The user is an agency owner who reviews everything before it goes out. Plain words, very short copy, no AI-sounding language.

**The user chooses every image.** Never generate, draw or edit images. Give search keywords and render the user's chosen photo into the creative.

## Inputs
- **Client profile JSON** (format in `assets/example-client-profile.json`). The application writes it when the client is onboarded: name, website, location, services with page URLs, audiences, call to action, author, brand colours and the **logo file and mode**. If the user has no profile, ask once for those fields and the logo file, write the JSON, and carry on. Never invent a logo, a service or a fact.
- Optional: Search Console queries, GA4 landing pages, existing blog titles, a `client-intelligence-report` ledger, meeting notes. Use them to choose topics and avoid repeats.

## Workflow
Work in `/home/claude/work/<client-slug>/`. Deliver to `/mnt/user-data/outputs/<client-slug>/`.

**Stage A: topics (always first)**
1. Read `references/topic-rules.md`. Write exactly five topics. If no search data was given, one or two web searches for how people phrase these questions is enough.
2. For every topic also write, now: `copy.json` (eyebrow, heading, description; `references/creative-rules.md`), `posts.json` (`references/social-rules.md`) and `image-keywords.txt`. Run `python scripts/lint_copy.py --type creative|posts --file <file> --profile <profile>` and rewrite anything that fails.
3. Render previews with `scripts/render_creative.py` (no image, so brand colour background) so the user sees the layout and logo.
4. Save `topics.md` and show the five in chat as a compact table: question, who asks, linked service, primary image keyword. Ask once: which topics to write as full blogs (default all five) and to send the chosen images, one landscape photo per topic, 2400px wide or more. If the user already said to do everything, go straight to Stage B.

**Stage B: blogs and final creatives**
5. For each chosen topic read `references/blog-rules.md`, write `blog.md`, and run `python scripts/run_pack.py --profile <profile> --dir <topic dir> [--image <photo>]`. It lints the copy, posts and blog, builds `blog.html` and `blog.schema.json`, and renders the creatives. Fix every failure by rewriting the text, never by loosening a rule.
6. View the PNGs. Check: text is readable, nothing touches the logo, the lower left of the photo is calm, **and there is no box, border, panel or frame anywhere**. If the photo is the problem (bright or busy where the text sits, too small), say so and ask for another from the alternate keywords.
7. Finish with a short chat summary: files made, warnings, and what the user must still do (images missing, logo missing, licence and attribution check on photos).

## Output
```
<client-slug>/
  topics.md
  <yyyy-mm-dd>-<topic-slug>/
    blog.md  blog.html  blog.schema.json
    posts.json   copy.json   image-keywords.txt
    creatives/  facebook.png  linkedin.png  instagram.png   (or *-preview.png without a photo)
```
Share files with `present_files`. The Markdown is the clean copy for agents; the HTML carries the Article, FAQPage and Organization markup.

## Hard rules
- **No em dashes or en dashes** anywhere. No spaced hyphens used as pauses.
- **No AI words.** `references/banned-words.txt` lists them, and the lint fails the draft. Do not hunt for synonyms of the same style; write in plain words.
- **Very simple language.** Short sentences, concrete nouns, grade 8 or lower.
- **Social posts are only the gist**: Facebook 200 characters, LinkedIn 240, Instagram 140, hashtags 0 to 3.
- **Creatives hold three text elements only**: eyebrow (24 characters), heading (40), description (80). Plus the client logo. Nothing else.
- **Strictly no frame in frame.** No borders, boxes, cards, panels, pills, badges or inset frames. The photo fills the canvas; text sits on a soft fade.
- **Blogs**: short answer first, subheadings are questions, each section opens with the answer, quick answers at the end, no invented facts or numbers, sources only for facts that need them.
- Facts come from the profile, provided data, or a page you can link. Never invent statistics, prices, awards or years in business.

## Files
- `references/topic-rules.md`, `blog-rules.md`, `social-rules.md`, `creative-rules.md`: the rules for each piece.
- `references/banned-words.txt`: words and phrases that fail the lint (clients can add their own in the profile).
- `scripts/lint_copy.py`: checks blog, posts or creative copy. `scripts/build_blog.py`: HTML and schema. `scripts/render_creative.py`: creatives. `scripts/run_pack.py`: all of it for one topic.
- `assets/example-client-profile.json`, `example-blog.md`, `example-posts.json`, `example-copy.json`, `example-logo.png`, `example-photo.jpg`: a fictional example and test fixtures. Copy the structure, never the content. The photo is a plain test image, not a real photo.
