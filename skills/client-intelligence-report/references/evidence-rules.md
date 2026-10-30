# Evidence rules

Use this when classifying each claim. The goal is a client PDF where every statement can be defended if the client challenges it.

## Evidence types

| Type | Use when | Allowed in client PDF |
|---|---|---|
| `stated` | The client's own website or official profile says it, and the saved page text confirms it on re-reading | Yes |
| `corroborated` | Two or more independent sources agree | Yes |
| `client_confirmed` | The client confirmed it in the meeting (version 2) | Yes |
| `observed_absence` | The reviewed pages do not mention it, and the crawl covered the relevant areas (see below) | Yes, worded as "The pages reviewed do not mention X" |
| `inferred` | Your judgment from patterns or marketing knowledge | No. Becomes a question |
| `single_external` | One third-party source only | No. Becomes a question |

## What counts as independent

Independent means a different organization with its own basis for the statement. These are NOT independent of each other: the client's website and its social profiles; a directory listing copied from the client's site; two articles quoting the same press release; reviews on several platforms written by one person. A government register, an industry body, a news outlet's own reporting, and verified customer reviews on separate platforms are independent of the client.

## Observed absence

Use only when you read the pages where the item would appear (for "commercial services", the services pages and the about page) and record which pages those were in the claim note. Word it neutrally: "The pages reviewed do not mention commercial projects." Never imply the business does not offer it. An absence can never be the sole basis of an opportunity or a standout point; pair it with a competitor fact or a stated fact, which the builder enforces.

## Reviews and testimonials

A review theme may be stated only when at least 10 reviews were read across the platforms found and at least 30% of them express it; record the count in the claim note ("7 of 18 reviews mention punctuality") and state it in the PDF as a proportion, never as a quote. Testimonials on the client's own site are `stated` ("Testimonials on the site highlight punctuality"). Paraphrase; do not quote customers or name them. Check each platform's terms before collecting review text.

## Competitors

A business qualifies as a competitor for the PDF only if the user named it, or it passes both tests on its own website: (1) at least two listed services or products overlap with the client's, and (2) it states a service area or location that overlaps the client's. Record both facts as claims and cite them in the competitor table. Businesses that fail either test go into the meeting questions ("Do you compete with X?"), not the PDF. Take every fact from the competitor's own site. Compare only observable attributes (services, locations, displayed pricing, guarantees, certifications, content activity). Never state strengths, weaknesses, undisplayed prices, size, or revenue.

## Market facts

Include only statistics or trends that come with a named source and a date, and that are relevant to this client's market and region. If you cannot source it, leave it out. Do not describe "the market" in general terms.

## Conflicts and unreadable pages

If two sources conflict, drop the claim from the PDF and turn the conflict into a question. If a page could not be read, do not infer its content.

## Quotes and verification

Every `stated` or `corroborated` claim carries a quote of under 15 words copied exactly from the saved page. The builder checks the quote against the saved text (case and punctuation are normalized) and refuses the build if it is missing. Pasted text from the user is saved the same way; if no page could be saved, build with `--no-verify` and tell the user the quotes were not machine-verified.

## Google Business Profile

Rating and review count from `places_search` are `stated` with `source_url` `google-business-profile://<place_id>` and `source_title` `Google Business Profile, retrieved <date>`; paste the tool's rating and count into the claim note. No saved page is required for these claims. Review text from the tool is a sample and never supports a PDF statement.

## Numbers

Any number in the PDF (years, counts, prices, percentages) must appear in a claim's text or quote. The builder checks this per block. Keep numbers exactly as the source states them.

## Aspirations and positioning

Version 1 includes only what the client states (mission, vision, goals on its site). What the business "wants to become" otherwise is a meeting question. Version 2 adds client-confirmed goals.

## Personas

Not in version 1. In version 2, build audience profiles only from site evidence plus client-confirmed information.

## Safe wording

Use plain statements: "The site lists six services." "Birch & Co. serves the Greater Toronto Area." Avoid words that signal uncertainty. If you feel you need one, the claim does not belong in the PDF.
