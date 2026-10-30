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
6. Sign in with your email, open Settings, paste your Anthropic API key and press "Save and test".

## Deploy to Netlify
- New site from the GitHub repo. Build command and publish folder come from `netlify.toml`.
- Site settings → Environment variables: add the four values from `.env`.

## Built so far
- Database: workspaces, clients, voice, examples, facts, research runs, topics, posts, API usage; row-level security; Claude key in Vault; uploads bucket.
- App: magic-link sign-in, Skipper-styled shell, Clients list, Add client step 1 (Business), Settings · Claude API (save and test key, models per task, batch toggles, monthly cap, usage this month).
- Functions: `/api/claude-key` (save and test the key).

## Next
1. Add client steps 2–5: voice and tone (with live sample), rules and claims, facts, examples.
2. Research run (long job) and the research report screen.
3. Next 5 topics, writing posts in a batch, checks, review screen.
4. Social copy and image keywords.
