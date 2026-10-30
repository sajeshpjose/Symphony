# Open questions and unverified items

## Business
- Confirm actual pricing per client today and whether clients already track leads in GA4 (assumptions A4 and A5 in the model).
- Which posting service: Postiz self-hosted (free, more ops) or cloud (USD 29 a month for 5 accounts; 15 accounts needed for 5 clients on 3 channels) or Ayrshare (USD 149 or 499 a month). Verify current pricing.
- Lawyer review: performance pricing, AI-assisted content and IP clauses, image licences, CASL, privacy.

## Product
- Who approves content on the client side, and whether some clients should skip approval after the first four posts.
- Whether to show indicative pricing on client sites (came up for both real clients).
- Whether the founder's LinkedIn profile or the company page carries social for Danburite.

## Technical
- Confirm current Anthropic pricing for Sonnet and Haiku classes, Batch API, prompt caching, and web search tool fees before setting caps.
- WordPress: application passwords and plugin conflicts on each client site.
- Posting service API limits and whether Instagram requires a professional account linked to a Facebook page (it does per Meta; confirm per client).
- GA4 Data API quotas and data retention (set to 14 months per client).
- LinkedIn company pages cannot be fetched; rely on exports or Claude in Chrome.

## Research in the app (D32 to D35)
- First real runs needed: compare an in-app run on danburitecorp.com and grandmoor.ca with the samples. Watch the cost per run and the share of claims dropped by the quote check.
- Places API terms limit caching of place content; the report keeps the rating and count with the retrieval date. Check that this fits Google's terms before reports go to clients.
- Not ported yet: LinkedIn analytics importer, GA4 detailed exports, Google Ads. Charts are not drawn in the app report (tables only).
- Sites that load their text with scripts give too few words; the run asks for pasted text. A headless browser in the job would remove that step.
- The skill's Python GA4 importer crashed when weeks were missing from the export (fixed Oct 30, 2026; the .skill file needs repackaging).

## Skills
- `client-intelligence-report`: tested on two real sites and fictional data. Still to add: non-Latin font fallback, Google Ads importer, LinkedIn company page importer, competitor chart.
- `client-content-pack`: tested on fictional data only. First real run needed. Check how real photos behave with the fade (bright lower-left photos get a warning).
- Both skills run on the Claude plan; a long research run uses a noticeable share of plan usage.

## Figma
- Starter plan MCP limit reached twice. Pending screens are specified in docs/07-figma.md; the flow diagram exists as SVG to import.
