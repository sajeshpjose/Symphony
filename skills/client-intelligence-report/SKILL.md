---
name: client-intelligence-report
description: Research a client's or prospect's business from its website URL and produce (1) a client-facing branded PDF "Brand Intelligence Report" containing only well-evidenced claims, (2) a separate INTERNAL Word document of questions to ask in the first client meeting, and (3) an internal claims ledger spreadsheet with a source for every claim. Use this whenever the user shares a client or prospect website address, or asks for a client analysis, discovery report, onboarding report, brand or positioning audit, competitor or market analysis, customer or audience research, or meeting prep for a new client, even if they do not use those exact words. Also use it when the user returns with answers from the first client meeting and wants the report updated (version 2).
---

# Client Intelligence Report

Turn a client's website into three deliverables: a client-safe PDF, an internal question list for the first meeting, and an internal claims ledger. The user is a digital marketing agency owner who will hand the PDF to the client, so a wrong or hedged statement in it damages their credibility. Everything below serves one idea: **the PDF contains only what can be defended, and everything uncertain becomes a question for the meeting.**

## The evidence rule

A claim may appear in the client PDF only if its evidence type is one of:

| Evidence type | Meaning |
|---|---|
| `stated` | The client says it on its own website or official channel, and you re-checked the saved page text |
| `corroborated` | Two or more independent sources support it (see `references/evidence-rules.md` for what "independent" means) |
| `client_confirmed` | The client confirmed it in the meeting (version 2 only) |
| `observed_absence` | The reviewed pages do not mention something, and the crawl was broad enough to say so plainly |

Anything else (`inferred`, `single_external`, conflicting sources, unreadable pages) is never stated in the PDF. Inferences and single-source findings become interview questions; conflicts and unreadable pages are dropped. Read `references/evidence-rules.md` before classifying claims.

Why this matters: the user cannot ask the client to forgive an invented statistic or a guessed competitor weakness. A shorter, fully defensible report beats a long, polished, partly invented one. If the site is thin, produce a short report and a long question list. Never pad.

## Workflow

Work in `/home/claude/work/<client-slug>/`. Final files go to `/mnt/user-data/outputs/` and are shared with `present_files`. Keep to a budget of about 8 web searches per run unless the user asks for deeper research; this runs on their plan.

1. **Intake.** Confirm the website URL and collect optional inputs: client name, location, industry, known competitors, social links, goals, pasted text, or a brand deck. Then, before crawling, ask the user once for the optional data uploads, in one short message, and say the report proceeds without them if they have none:
   - GA4 exports (the "Generate leads overview" CSV, or traffic acquisition, pages, landing pages, key events) for the last 12 months
   - Search Console Performance exports (Queries and Pages, 16 months)
   - A completed social snapshot (`assets/social-snapshot.xlsx`, public-view figures for the client and competitors), or LinkedIn Page analytics exports including the Competitors tab
   - Ad platform exports: a Meta Ads Manager campaign report, Google Ads or LinkedIn Ads, for the same period
   - A Google reviews export if they have one (Google reviews are otherwise fetched automatically with `places_search`)
   If the user says to go ahead without them, do not ask again. When files arrive, follow `references/analytics-inputs.md`: run the matching importer, save its text copy with `save_page.py` under `file://<file name>`, and add the sections `search`, `analytics`, `ads`, `reviews` or `social` as the data allows. Use `chart` blocks (see `references/data-schema.md`) where a comparison reads better as a picture: review counts across competitors, sessions and key events by channel, spend by ad set, weekly or monthly trends. Recreate GA4's own graphs from the exported numbers rather than pasting screenshots.
2. **Crawl by following links.** Fetch the homepage, then follow links found in fetched pages (navigation, footer, sitemap links if the page links to one). Do not type URLs you have not seen on a page; fetching guessed paths fails and leads to overclaiming. Aim for 10 to 25 pages: about, services or products, pricing, locations, team, blog, case studies, testimonials, FAQ, contact. Public pages only; honour robots rules; never log in, bypass blocks, or collect personal data about individuals. **Save every page you read** with `python scripts/save_page.py --dir work/<slug>/pages --url <url> --file <text>`; the builder later verifies each quote against these files. If a site blocks fetching or returns under about 100 words, stop and ask the user to paste page text or upload a brand deck; save pasted text the same way and build with `--no-verify`, saying so in the summary.
3. **Extract.** Record every fact as a claim in the ledger (schema in `references/data-schema.md`): section, plain claim text, a supporting quote under 15 words copied exactly from the saved page, source URL, evidence type, status.
4. **Research outside the site.** Fetch Google ratings and review counts for the client and each qualifying competitor with `places_search` (rules in `references/analytics-inputs.md`); the result is a `stated` claim with Google as the source. Search for competitors (those the user named, plus businesses that pass the competitor test in `references/evidence-rules.md`), public review themes, and market facts that come with a citation and date. Competitor facts come from each competitor's own site. Save each page read.
5. **Verify and decide.** Check for conflicts between sources. Mark each claim `included`, `question`, or `dropped`. Turn every important gap into a question using `references/question-bank.md`, recording what triggered it and what the site says.
6. **Write `report-data.json`.** Build sections from included claims only, following `references/report-sections.md`. Every block cites the claim IDs it rests on. Open the Business overview with a `facts` strip when at least two plain facts exist (founding year, number of services, service area). Personas are not part of version 1.
7. **Build.** `python scripts/build_outputs.py --data report-data.json --out /mnt/user-data/outputs --pages work/<slug>/pages`. The builder refuses: claims that are not included or not allowed; quotes not found in the saved page; numbers not present in cited claims; quotes of 15 words or more; opportunities or standout points resting only on an observed absence. Fix the data, never the check.
8. **QA.** `python scripts/qa_check.py --pdf <report.pdf> --data report-data.json`. Fix every failure and rebuild, then view the PDF pages as images and check layout (orphaned headings, tables that break awkwardly, empty space).
9. **Report back.** A short chat summary: sections included and why, how many claims became questions, pages that could not be read, and whether quotes were verified. Share the three files with `present_files` and remind the user that the question list and ledger are internal.

## Writing the client PDF

- State facts plainly. The PDF must not contain hedging such as "likely", "probably", "may", "appears to", "seems", or "needs validation"; if a point cannot be stated plainly, it does not belong in the PDF.
- Write for the client's owner: clear, specific, jargon-light. Lead each section with the point, then the evidence.
- Do not mention the questions, the ledger, evidence levels, or confidence in the PDF. The final "Sources and method" page is generated by the builder and says only what was reviewed and when.
- Do not name individual customers or private people. Paraphrase reviews and testimonials; show themes, not copied text.
- No revenue, customer-count, traffic, or market-share estimates. Market statistics only with a source and date.
- Competitor comparison covers observable facts only (services, locations, displayed pricing, guarantees, certifications, content activity). No judgments about quality.
- Do not recommend anything that does not follow from a verified claim. An opportunity is a verified gap, for example "Three competitors list emergency service; this site does not mention it", described neutrally. When at least three opportunities exist, add an `actions` section: a table of Action, Why now and Evidence, one row per gap, each row citing the claims that document the gap. Actions say what we would do (configure, pause, publish, fix, test), never what will result.
- If a section has too little verified content, shorten it or leave it out. The builder renumbers automatically.

## Writing the internal question list

Group by topic: goals and priorities, customers and decision makers, offerings and pricing, competitors they lose to, brand and voice, marketing and measurement, constraints and topics to avoid. Each question has: the question, why it is being asked (the trigger), what the site currently says, and priority (`must` or `nice`). Aim for 15 to 30 questions, with the must-asks first within each topic. Use `references/question-bank.md` for prompts that fit common gaps, but write questions specific to this client.

## Version 2 (after the meeting)

The user types the client's answers into the **Answer from client** column of the ledger spreadsheet and gives it back. Run `python scripts/import_answers.py --ledger <ledger.xlsx> --data report-data.json --out report-data-v2.json --meeting-date <date>`. Each answer becomes a `client_confirmed` claim and the question is marked answered. Then write the version 2 sections (`goals`, `profiles`, `positioning`, `plan`) citing those claims plus existing site evidence, rebuild with `--version v2`, and list the questions that remain. If the user gives answers in chat instead, add them to the ledger column first so the record stays in one place. Audience profiles describe segments the client confirmed or the site evidences, with goals, concerns, and what they value, and nothing the sources do not support.

## Branding

Branding lives in `assets/brand-config.json`: the agency's symbol only (never the name as text; dotyello.com and hello@dotyello.com appear on the back page), charcoal `#222222` as the only strong colour, and a mustard accent used only for the short rule under section numbers and on the cover and back page. The mark is drawn as vector paths by the builder, and `assets/yello-mark.svg` holds the same symbol for other uses. Do not write the brand name anywhere in the PDF, the internal document, or file metadata. Do not add colour, icons, or decoration beyond this; the report's authority comes from clear structure, generous white space, and plain statements. Use `"lead": true` on a single opening paragraph of a section when it carries the key point. Only ask about branding if the user says the report is for a different agency.

## Files

- `references/evidence-rules.md`: how to classify claims, what counts as independent, section by section requirements.
- `references/data-schema.md`: exact format of `report-data.json`.
- `references/report-sections.md`: the section list, what each needs, and wording guidance.
- `references/question-bank.md`: question prompts by topic and trigger.
- `references/analytics-inputs.md`: GA4, Search Console, Google reviews, social snapshot and LinkedIn exports; what each produces and the rules for using it.
- `references/social-snapshot.md`: the public-view social audit and its formulas.
- `scripts/build_outputs.py`: builds the PDF, the internal Word document, and the ledger spreadsheet.
- `scripts/qa_check.py`: client-safety checks on the finished PDF.
- `scripts/save_page.py`: saves fetched page text for quote verification.
- `scripts/import_answers.py`: turns meeting answers in the ledger into version 2 claims.
- `scripts/import_ga4_overview.py`, `scripts/import_gsc.py`, `scripts/import_social.py`, `scripts/import_linkedin_profile.py`, `scripts/import_meta_ads.py`: turn uploaded exports into claim-ready facts plus a text copy for quote verification.
- `assets/social-snapshot.xlsx`: the template the user fills for the social audit.
- `assets/brand-config.json`: yello branding (colours, fonts, contact details).
- `assets/yello-mark.svg`: the yello logo mark.
- `assets/example-report-data.json` and `assets/example-pages/`: a fictional, fully valid example with its saved pages. Copy the structure; never reuse the content.
