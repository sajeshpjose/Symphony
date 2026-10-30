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
3. Supabase dashboard → Authentication → URL configuration: add `http://localhost:8888` and your Netlify URL to the redirect URLs (for magic links).
4. Copy `.env.example` to `.env` and fill in the Supabase URL, anon key and service role key (Project settings → API).
5. Run everything: `npm run dev` (Netlify dev on http://localhost:8888, which serves the app and the functions).
5b. In a second Terminal tab, start the background worker: `npm run dev:trigger` (see Trigger.dev below).
6. Sign in with your email, open Settings, paste your Anthropic API key and press "Save and test".

## Trigger.dev (long jobs)
Research runs and post batches run as Trigger.dev tasks in `src/trigger/`, configured in `trigger.config.ts` (project `proj_upzozzqxpiovdxrciytc`).

First time only:
1. `npx trigger.dev@latest login` (opens the browser).
2. Dashboard → Development environment → API keys → create a key with "Trigger only" access. Put it in `.env` as `TRIGGER_SECRET_KEY`.

Every time: `npm run dev:trigger`. It registers the tasks with the dashboard and runs them on your Mac. Check it with the `hello-world` task: dashboard → Test → payload `{ "name": "Symph" }`.

Deploy tasks to production with `npm run deploy:trigger`, and add the production `TRIGGER_SECRET_KEY` to Netlify's environment variables.

## Deploy to Netlify
- New site from the GitHub repo. Build command and publish folder come from `netlify.toml`.
- Site settings → Environment variables: add the four values from `.env`.

## Built so far
- Database: workspaces, clients, voice, examples, facts, research runs, topics, posts, API usage; row-level security; Claude key in Vault; uploads bucket.
- App: magic-link sign-in, Skipper-styled shell, Clients list, Settings · Claude API (save and test key, models per task, batch toggles, monthly cap, usage this month).
- Add client, all 5 steps: Business; Voice and tone (sliders, traits, live sample by Claude Haiku, editable summary); Rules and claims (word lists, claims, disclaimer, instant rule check); Facts (add, approve, mark needs proof); Examples (loved and disliked posts, "learn from examples"). Client page shows the voice and rules once set up; every step can be edited later.
- Shared: `voiceBrief()` builds the client brief every Claude call uses (cached); `lintText()` ports the content skill's dash, banned-word and pattern checks.
- Functions: `/api/claude-key` (save and test the key), `/api/voice-sample`, `/api/learn-voice`.
- Trigger.dev: config and a `hello-world` task to check the connection.

## Next
1. Research run (Trigger.dev task) and the research report screen.
2. Next 5 topics, writing posts in a batch, checks, review screen.
3. Social copy and image keywords.
