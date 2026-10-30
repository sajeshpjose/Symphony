# The two skills

Both are Claude skills (SKILL.md plus references, scripts and assets). Install by opening the .skill file in Claude and saving it. Source folders are included for porting into the app.

## client-intelligence-report
Input: a client website URL plus optional uploads (GA4 exports, Search Console exports, Meta Ads export, LinkedIn analytics export, social snapshot). Google ratings are fetched automatically.
Output: a client PDF (yello branded), an internal meeting questions document, an internal claims ledger spreadsheet, and report-data.json.
Rules: a claim reaches the PDF only if the client states it on its own channels, two independent sources agree, the client confirmed it, or it is a plainly worded observed absence. Quotes are verified against saved page text. Numbers must appear in cited claims. Opportunities cannot rest on an absence alone. Competitors need two overlapping services and an overlapping area. Review themes need 10 reviews and 30 percent. No hedging words; QA script scans the PDF.
Scripts: build_outputs.py (PDF, docx, xlsx, charts), qa_check.py, save_page.py, import_ga4_overview.py, import_gsc.py, import_social.py, import_linkedin_profile.py, import_meta_ads.py, import_answers.py (version 2 from the ledger).
Porting note for the app: report-data.json is the contract. The app can generate it and call the same builder.

## client-content-pack
Input: client profile JSON (written by the app at onboarding: name, website, services with URLs, audiences, CTA, author, brand colours, logo path and mode, banned words) plus optional search data.
Output: topics.md with five question topics; per topic blog.md, blog.html with Article, FAQPage and Organization JSON-LD, posts.json (Facebook 200, LinkedIn 240, Instagram 140 characters), copy.json (eyebrow 24, heading 40, description 80), image-keywords.txt, creatives for Facebook 1200x630, LinkedIn 1200x627, Instagram 1080x1350.
Rules: no em or en dashes, banned-word list, grade 8 reading level, answer-first blogs with question subheadings and quick answers, no invented facts, no frame in frame, user chooses the image.
Scripts: lint_copy.py, build_blog.py, render_creative.py, run_pack.py.
Porting note: lint_copy.py and render_creative.py are deterministic and can run inside the app unchanged; the writing happens via the API with the rule files as the system prompt.
