# Symph (Autopilot) — notes for Claude

Internal content platform for the yello agency. Read docs/10-mvp-scope.md first; docs/02-decision-log.md records every decision.

## Layout
- web/ — Vite + React + TypeScript app (React Router 7, TanStack Query, Tailwind 4). Skipper design tokens in web/src/index.css; small UI kit in web/src/components/ui.tsx.
- netlify/functions/ — short server calls (30 s limit). Shared helpers in _shared/ (auth via Supabase session, Claude client from Vault, usage logging, cap check).
- src/trigger/ + trigger.config.ts — Trigger.dev tasks for long jobs (research runs, post batches). Import from "@trigger.dev/sdk" only (never /v3), export every task, use built-in fetch, never wrap wait.* or triggerAndWait in Promise.all.
- packages/core/ — models, prices, shared jsonb types. Prices must match https://platform.claude.com/docs/en/about-claude/pricing.
- supabase/migrations/ — schema and row-level security. Every table carries workspace_id; policies use public.is_member().
- skills/ — the two Claude skills whose prompts and rules the app ports (client-intelligence-report, client-content-pack).

## Rules
- The Anthropic key lives only in Supabase Vault; read it server-side with get_anthropic_key(). Never send it to the browser.
- Log every Claude call with logUsage() and call assertUnderCap() before starting paid work.
- Writing rules for generated content: plain language, no em or en dashes, banned words in skills/client-content-pack/references/banned-words.txt.
- UI copy: short, plain, no jargon. Match the Figma "MVP" page.
- samples/ holds real client research and is not committed.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.claude/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-tasks`, `trigger-cost-savings`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
