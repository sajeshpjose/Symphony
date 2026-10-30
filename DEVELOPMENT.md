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
- App: magic-link sign-in, Skipper-styled shell, Clients list, Add client step 1 (Business), Settings · Claude API (save and test key, models per task, batch toggles, monthly cap, usage this month).
- Functions: `/api/claude-key` (save and test the key).
- Trigger.dev: config and a `hello-world` task to check the connection.

## Next
1. Add client steps 2–5: voice and tone (with live sample), rules and claims, facts, examples.
2. Research run (long job) and the research report screen.
3. Next 5 topics, writing posts in a batch, checks, review screen.
4. Social copy and image keywords.
