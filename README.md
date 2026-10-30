# Symph: agency content platform for yello

Prepared 29 October 2026 for yello (dotyello.com). Everything decided and built so far, in one place, so the work can continue in another Claude account.

## Build the app
The app code lives here too. See `DEVELOPMENT.md` to run it and `docs/10-mvp-scope.md` for what the first release does.

## Start here
1. `docs/01-prd.md` — what the product is, who it is for, scope, and what is explicitly out of scope.
2. `docs/02-decision-log.md` — every decision made in the planning conversation, with the reason.
3. `docs/03-architecture.md` — system design, data model, integrations, cost model, and the API versus subscription question.
4. `docs/04-service-flow.md` — the seven-phase service flow and the build order (also drawn in `design/content-service-flow.svg`).
5. `docs/05-phases-and-estimates.md` — build phases, hours, running costs.
6. `docs/06-open-questions.md` — what is still undecided or unverified.
7. `docs/07-figma.md` — the Figma file, what is built, specs for the pending screens.
8. `docs/08-skills.md` — the two Claude skills, how they fit into the app, and how to run them.
9. `docs/09-memory-for-new-claude.md` — a short brief to paste into the new Claude so it starts with the right context.
10. `docs/10-mvp-scope.md` — what the MVP includes and leaves out.

## Skills (install in the new account: open the .skill file and save it)
- `skills/client-intelligence-report.skill` and its source in `skills/client-intelligence-report/`
- `skills/client-content-pack.skill` and its source in `skills/client-content-pack/`

## Samples (kept out of git; real client data)
- `samples/danburite/` — full intelligence report run on danburitecorp.com (client PDF, internal questions, ledger, report data).
- `samples/grandmoor/` — full run on grandmoor.ca with GA4, Meta Ads and Google reviews, charts and action points.
- `samples/content-pack/` — fictional content pack sample (blog, posts, creatives).

## Design
- Figma file: https://www.figma.com/design/lqyyzmSaJxirwnOQ7P9pvh (pages MVP, Screens v2, Screens). See `docs/07-figma.md`.
- `design/content-service-flow.svg` and `.png` — the service flow diagram, importable into Figma.
- `design/yello-mark.svg` — the yello logo mark used in reports.
