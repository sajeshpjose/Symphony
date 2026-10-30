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

## Skills
- `client-intelligence-report`: tested on two real sites and fictional data. Still to add: non-Latin font fallback, Google Ads importer, LinkedIn company page importer, competitor chart.
- `client-content-pack`: tested on fictional data only. First real run needed. Check how real photos behave with the fade (bright lower-left photos get a warning).
- Both skills run on the Claude plan; a long research run uses a noticeable share of plan usage.

## Figma
- Starter plan MCP limit reached twice. Pending screens are specified in docs/07-figma.md; the flow diagram exists as SVG to import.
