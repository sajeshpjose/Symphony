# PRD: Agency content platform (working name "Autopilot")

## One line
An internal tool for yello, a digital marketing agency, that researches a client, learns their voice, produces weekly blog and social content with creatives, routes it through client approval, publishes it, and measures leads so the agency can charge per lead.

## Who it is for
- Primary user: Sajesh, agency owner. Reviews everything, chooses images, manages clients.
- Secondary user: the client (business owner or marketing contact). Approves posts via a shareable link, no login.
- Not for the public. Not for sale as a SaaS (decided; see decision log D2).

## Problems it solves
1. Research and onboarding take days by hand; the intelligence report takes an hour and is defensible.
2. Content production is slow and inconsistent across clients; the content pack enforces voice, length and plain language.
3. Approvals by email are slow and messy; one link, four posts at a time, with a record.
4. Impact is hard to prove; GA4 and Search Console are wired in, leads are counted against a written definition, and a monthly ledger freezes the numbers for invoicing.

## Scope (MVP through v1)
- Client workspace: profile, brand kit (logo, colours, fonts), voice and tone, rules and claims, facts library, connected accounts, lead definition.
- Research: run the `client-intelligence-report` skill at onboarding and quarterly; store the ledger and questions; version 2 after the interview.
- Content: five topics a month per client; per topic a blog (Markdown plus HTML with Article and FAQPage markup), three social posts, three creatives, image keywords. User picks the image; the app renders the creative.
- Approval: shareable link per batch (four posts), approve or request changes, edits reset approval, full audit trail. Optional client-approval requirement per client.
- Publishing: WordPress as draft or scheduled; social via a posting service (Postiz or Ayrshare) once approved; tracked links; quiet hours; failure alerts; daily connection health check.
- Measurement: GA4 and Search Console pulls per client; Google Business Profile ratings; Meta Ads exports; engagement per post; monthly lead ledger with dispute window; token and cost tracking per client.
- Reports: monthly client report and the intelligence report; AI visibility check (manual at first).

## Out of scope
- Image generation. Figma-driven creatives are optional later.
- Public SaaS, self-serve signup, billing for third parties.
- LinkedIn company page scraping (blocked); use exports or Claude in Chrome.
- Direct platform APIs for Meta, LinkedIn, X at MVP (approvals take weeks); use a posting service.
- Auto-approval on client silence (decided off).

## Success criteria
- Research report for a new client in under one hour with zero unverified claims in the client PDF.
- Content time per post under 45 minutes including review.
- Every published post carries tracking; every lead is attributable or explicitly excluded.
- First four posts approved for a client within two weeks of onboarding.

## Pricing model (hybrid, assumed)
- Base fee about CAD 250 per client per month plus CAD 50 per qualified lead, after a three-month ramp. Pure per-lead only for clients with healthy traffic. Lead definition and seven-day dispute window written into contracts.

## Brand rules for all outputs
- yello appears only as the symbol (logo mark), dotyello.com and hello@dotyello.com. The name is never written out.
- Charcoal #222222, mustard #D9A520 used very sparingly (rules only), Poppins headings, Liberation Sans body.
- Plain language, no em or en dashes, no AI-sounding words (banned list in the content skill).
