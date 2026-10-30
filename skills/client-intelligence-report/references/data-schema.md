# report-data.json schema

The builder reads one JSON file. Write it after verification.

```json
{
  "version": "v1",
  "date": "2026-10-29",
  "client": {"name": "Birch & Co. Landscaping", "url": "https://birchandco.ca", "location": "Toronto, Ontario", "industry": "Landscaping"},
  "brand": {"agency_name": "Optional override of assets/brand-config.json"},
  "claims": [
    {"id": "C001", "section": "offerings", "text": "The site lists six services: lawn care, garden design, seasonal clean-ups, snow removal, tree care and irrigation.",
     "quote": "lawn care, garden design, seasonal clean-ups", "source_url": "https://birchandco.ca/services", "source_title": "Services",
     "evidence": "stated", "status": "included", "note": ""}
  ],
  "sections": [
    {"key": "offerings", "title": "Services and offerings", "page_break": true, "blocks": [
      {"type": "paragraph", "text": "Birch & Co. lists six services.", "claim_ids": ["C001"]},
      {"type": "bullets", "items": [{"text": "Lawn care", "claim_ids": ["C001"]}]},
      {"type": "table", "headers": ["Service", "What the site says"], "rows": [[{"text": "Snow removal", "claim_ids": ["C002"]}, {"text": "Winter contracts for homes.", "claim_ids": ["C002"]}]]},
      {"type": "callout", "title": "Key point", "text": "...", "claim_ids": ["C001"]},
      {"type": "paragraph", "text": "Structural sentence with no facts or numbers.", "claim_ids": [], "structural": true}
    ]}
  ],
  "_pages": "Saved page texts live in work/<slug>/pages/ (scripts/save_page.py); pass the directory to the builder with --pages.",
  "questions": [
    {"id": "Q01", "topic": "Goals and priorities", "question": "Which job type do you want more of this year?",
     "trigger": "Six services listed with no clear priority", "site_says": "Equal weight on every service page", "priority": "must", "claim_ids": ["C001"]}
  ],
  "sources": [
    {"url": "https://birchandco.ca/services", "title": "Services page", "type": "client site", "fetched": "2026-10-29"}
  ]
}
```

## Field rules

- `claims[].evidence`: `stated`, `corroborated`, `client_confirmed`, `observed_absence`, `inferred`, `single_external`.
- `claims[].status`: `included`, `question`, `dropped`.
- `claims[].quote`: under 15 words, taken from the source. Empty only for `observed_absence`.
- Block types: `paragraph`, `bullets`, `table`, `callout`, `facts`, `chart`.
- A `chart` block: `{"type": "chart", "kind": "bar" | "column" | "line", "title": "...", "unit": "", "items": [{"label": "...", "value": 60, "claim_ids": ["C030"], "highlight": true}], "caption": "...", "claim_ids": [...]}`. For several series use `"series": [{"name": "Sessions", "items": [...]}, ...]` instead of `items`. Every point's value must appear in its cited claims; the title and caption are checked against the block's `claim_ids`. Use `bar` for ranked comparisons (one series), `column` for channel or category comparisons (up to three series), `line` for monthly trends. Charts are drawn in charcoal and greys; `highlight` marks the client's own bar in charcoal. A `facts` block is `{"type": "facts", "items": [{"label": "Serving homeowners since", "value": "2009", "claim_ids": ["C002"]}]}` with 2 to 4 items; values are short (a number, a year, a place). A paragraph may set `"lead": true` to render larger as the section's opening statement (one per section).
- `claims[].quote` must be under 15 words; the builder rejects longer quotes.
- Every block lists `claim_ids`. The builder renders a block only if every ID exists, has `status: included`, and has an allowed evidence type. Blocks with no `claim_ids` must set `"structural": true` and may not contain digits.
- Every number in a block must appear in the text or quote of the claims it cites. Table cells are checked individually.
- `sections[].key` should come from `references/report-sections.md`. Sections with no renderable blocks are omitted.
- `questions[].priority`: `must` or `nice`.
- `sources[].type`: `client site`, `competitor site`, `review platform`, `publication`, `register`, `client export`, `google business profile`, `other`.
- Uploaded exports use `source_url` `file://<file name>` and must be saved with `save_page.py` under that URL (the importer writes the text copy).
