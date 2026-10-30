# Architecture

## Shape
A hosted web app (single tenant for the agency) with a scheduler. Claude is called through the Anthropic API; the two skills run in Claude.ai by hand for research and content until the same logic is ported into the app.

```
Scheduler (cron, weekly per client)
  -> topic scan (RSS, Search Console, past posts)            Haiku-class, batch
  -> shortlist review (user picks topics)                     dashboard
  -> drafts: blog + social + creative copy                    Sonnet-class, batch, cached brand prefix
  -> lint (dashes, banned words, lengths)                     deterministic scripts
  -> user review and image choice                             dashboard
  -> render creatives (photo + fade + 3 lines + logo)         Pillow, deterministic
  -> client approval link (4 posts)                           dashboard public page
  -> publish: WordPress REST (draft or scheduled), posting service for social, tracked links
  -> measure: GA4 Data API, Search Console API, GBP ratings, Meta exports
  -> monthly: lead ledger freeze, client report, token cost report
```

## Data model (core tables)
- `clients`: name, website, location, industry, status, approval_required, pause flag.
- `brand_kits`: client_id, logo_path, logo_mode, primary, accent, fonts, figma_file (optional).
- `voice_profiles`: formality, humor, sentence length, traits, point of view, spelling, emoji, hashtags, words to use, words to avoid, claims never to make, disclaimers, per-task instructions, per-channel overrides, approved examples, suggested rules (from edits).
- `facts`: client_id, type (service, price, testimonial, case study, FAQ), text, source, consent, approved_by, approved_at.
- `research_runs`: client_id, version, date, report_data (json), ledger path, questions path, pdf path.
- `topics`: client_id, month, title, who_asks, gist, linked_service, image_keywords, status.
- `posts`: topic_id, type (blog, facebook, linkedin, instagram), body, copy (eyebrow, heading, description), image_path, creative_paths, status (draft, in_review, awaiting_client, approved, scheduled, published, failed), version, approved_version, published_url, utm_campaign.
- `approval_batches`: client_id, token, expires_at, revoked, posts[], events[] (who, when, action, version).
- `connections`: client_id, kind (wordpress, posting_service, ga4, gsc, gbp, meta_ads), credentials ref, last_check, health.
- `metrics_daily`: post_id, date, sessions, engaged, clicks, impressions, position, key_events.
- `leads`: client_id, post_id, event, timestamp, landing_url, utm, status (counted, disputed, excluded), dispute_until, month_frozen.
- `ledgers`: client_id, month, counted, disputed, excluded, base_fee, lead_fee, total, frozen_at, sent_at.
- `api_usage`: client_id, call_id, model, input_tokens, cached_tokens, output_tokens, batch, cost_usd, purpose.

## Integrations
- Anthropic API: Messages, Batch API, prompt caching. Spend cap and alerts at 70 and 90 percent.
- WordPress: REST API with application passwords; create as draft or schedule; set categories and featured image.
- Posting service: Postiz (self-hosted free, cloud from USD 29 a month) or Ayrshare (USD 149 or 499 a month tiers); verify pricing before choosing.
- Google: GA4 Data API, Search Console API, Places API for GBP ratings; service account added as Viewer per client.
- Meta: exports at first; Ads API later.
- Stock photos: user chooses; optional Unsplash, Pexels, Pixabay search links. Respect attribution and hotlinking rules; store licence per image.
- Claude in Chrome (optional) for reading LinkedIn pages in the user's own session.

## Cost model (estimates, verify against current pricing)
- 5 clients, weekly posts, batch plus caching: USD 1 to 13 a month in tokens, most likely 4 to 5.
- Hosting and database about CAD 25 a month. Claude Pro about CAD 28 a month while building.
- Posting service is the first real added cost at Phase 2.
- API cap for 5 clients: USD 10 a month with alerts.

## Security and privacy
- Client credentials encrypted at rest; least-privilege Viewer roles; per-client pause switch.
- Approval links: 128-bit random tokens, expiry, revocation, optional email code for sensitive clients.
- Store licence and attribution per image; never scrape behind logins.
- Keep client data exportable (offboarding).
