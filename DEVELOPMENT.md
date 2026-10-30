# Development

## What you need
- Node 22 or newer
- A Supabase project (free plan is fine to start)
- The Netlify CLI: `npm i -g netlify-cli`
- Optional: the Supabase CLI (`brew install supabase/tap/supabase`) to run migrations from the terminal

## First-time setup
1. Install packages: `npm install`
2. Create the database:
   - Supabase dashboard → SQL editor → paste `supabase/migrations/20261030000000_mvp_schema.sql` → Run, **or**
   - `supabase link --project-ref YOUR-REF && supabase db push`
   - Already set up? Run the newer files in `supabase/migrations/` in order (for example `20261030120000_research_runs.sql`).
3. Supabase dashboard → Authentication → URL configuration: add `http://localhost:8888` and your Netlify URL to the redirect URLs (for magic links).
4. Copy `.env.example` to `.env` and fill in the Supabase URL, anon key and service role key (Project settings → API).
5. Run everything: `npm run dev` (Netlify dev on http://localhost:8888, which serves the app and the functions).
5b. In a second Terminal tab, start the background worker: `npm run dev:trigger` (see Trigger.dev below).
6. Sign in with your email, open Settings, paste your Anthropic API key and press "Save and test".

## Who can sign in
Sign-in is for existing accounts only (`shouldCreateUser: false`). To give someone access: Supabase → Authentication → Users → Invite user. Keep "Allow new users to sign up" turned off in Supabase → Authentication → Sign In / Providers.

## Trigger.dev (long jobs)
Research runs and post batches run as Trigger.dev tasks in `src/trigger/`, configured in `trigger.config.ts` (project `proj_upzozzqxpiovdxrciytc`).

First time only:
1. `npx trigger.dev@latest login` (opens the browser).
2. Dashboard → Development environment → API keys → create a key with "Trigger only" access. Put it in `.env` as `TRIGGER_SECRET_KEY`.

Every time: `npm run dev:trigger`. It registers the tasks with the dashboard and runs them on your Mac. Check it with the `hello-world` task: dashboard → Test → payload `{ "name": "Symph" }`.

Deploy tasks to production with `npm run deploy:trigger`, and add the production `TRIGGER_SECRET_KEY` to Netlify's environment variables.

The tasks read the database, so the Trigger.dev **Production** environment also needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (dashboard → Environment variables). In development, `trigger dev` reads them from `.env`.

## Google ratings (optional)
Google Cloud console → APIs and services → enable "Places API (New)" → Credentials → Create API key (restrict it to that API). Paste it in Settings → Google ratings.

## Deploy to Netlify
- New site from the GitHub repo. Build command and publish folder come from `netlify.toml`.
- Site settings → Environment variables: add the four values from `.env`.

## Built so far
- Database: workspaces, clients, voice, examples, facts, research runs, topics, posts, API usage; row-level security; Claude key in Vault; uploads bucket.
- App: magic-link sign-in, Skipper-styled shell, Clients list, Settings · Claude API (save and test key, models per task, batch toggles, monthly cap, usage this month).
- Add client is quick (name, website, industry, location; D36). The client page holds research and the content profile checklist; each profile part opens on its own, or all in order with "Set it all up". Profile parts: Business; Voice and tone (sliders, traits, live sample by Claude Haiku, editable summary); Rules and claims (word lists, claims, disclaimer, instant rule check); Facts (add, approve, mark needs proof); Examples (loved and disliked posts, "learn from examples"). Client page shows the voice and rules once set up; every step can be edited later.
- Shared: `voiceBrief()` builds the client brief every Claude call uses (cached); `lintText()` ports the content skill's dash, banned-word and pattern checks.
- Functions: `/api/claude-key` (save and test the key), `/api/voice-sample`, `/api/learn-voice`, `/api/suggest-business` (fill business details from research).
- Trigger.dev: config and a `hello-world` task to check the connection.
- Research (D32 to D35): `research-run` task in `src/trigger/` with the crawler, prompts, Claude calls and Places lookup in `src/research/`; evidence checks in `packages/core/src/research.ts` and upload importers in `packages/core/src/importers.ts`; `/api/research-start`, `/api/places-key`. Screens: Research list, New research run (website, known competitors, pasted text, exports), and the run page (live progress, report, claim review with "Add to facts", meeting questions, pages read).

## Figma covers (outside the MVP flow)
Posts carry cover text (eyebrow, heading, description) written with the post or on demand (`/api/cover-suggest`). The Figma plugin in `figma-plugin/` (see its README) makes new frames from a client's templates for each post; it reads through `/api/plugin-api` with a token made in Settings. Needs migration `20261031120000_covers_and_plugin.sql`.

## Next
Content generation (MVP flow steps 4 to 8 in docs/10-mvp-scope.md). Run `npm test -w @symph/core` for the core checks.

Done: client author, optional call to action and services (migration `20261031000000_content_inputs.sql`; run it in Supabase); author is required before content. Blog builder (HTML, Article, FAQPage and Organization markup) and blog and social checks in `packages/core/src/blog.ts`, with tests against the skill's example files.

1. **First real research runs** on Danburite and GrandMoor; tune prompts against the sample reports.
2. **Next 5 topics.** `/api/topics-suggest` reads the latest research, approved facts, services and existing topics, and returns five questions in the 2/2/1 mix from `topic-rules.md` (title, who asks, gist, service, image keywords). Topics screen: untick, "5 more", "Write selected posts".
3. **Post batch.** Trigger.dev `post-batch` task: one post per ticked topic, Batches API when the toggle is on, cached `voiceBrief()`. Run `checkBlog` and `checkSocial`; one automatic rewrite pass listing the failures.
4. **Social copy and image keywords** in the same pass, with their own checks.
5. **Content screen.** List per client, Markdown editor with HTML preview, checks panel, re-check on save, mark reviewed, copy or download, social tabs with character counts, Unsplash and Pexels links.
6. **Real clients end to end.** Record cost per post and tune models per task in Settings.

After the MVP (D29): approval links and publishing, then reporting and leads.
