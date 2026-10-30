# Analytics and engagement inputs

Optional uploads the user can provide at intake. Each is the client's own data, so figures from it are `stated` claims with the export named as the source. Read this file when any of these is uploaded, and run the matching script to turn the file into facts.

## 1. GA4 "Generate leads overview" CSV (or any GA4 overview export)
Export: GA4 → Reports → Business objectives → Generate leads → Overview → Share → Download CSV. Contains blocks: new and returning users by week, qualified and converted leads, key events by platform, new users by channel, retention, audiences, cities, organic landing pages by impressions, organic queries by clicks, sessions by manual source.
Script: `python scripts/import_ga4_overview.py --csv <file> --out ga4-facts.json`
Facts produced: date range, active users, new users by channel, key events (or their absence), weekly new and returning users with week labels and the peak week, the retention cohort table with week-one returns, top landing pages by Google impressions with blog share, top queries with branded share, cities.
Charts to recreate from this export (never paste the GA4 screenshots): a line chart of new and returning users by week, a column chart of sessions or users by channel, and a bar chart of channels by key events. GA4's own graphs are UI screenshots and do not belong in a client document.
Rules:
- **Sanity check first.** If Search Console clicks in the file are more than three times the GA4 users for the same period, the GA4 tag is not capturing traffic. Report this as a finding in the opportunities table ("analytics is not capturing site activity") and a must-ask question. Do not put GA4 traffic or lead figures in the PDF until the client confirms the setup.
- Search Console blocks (impressions, clicks, queries, landing pages) are reliable even when GA4 is not; use them for the `search` section.
- Branded share = clicks on queries containing the business name ÷ total clicks. State it as a percentage with both counts.
- Blog share of impressions = impressions on /blog paths ÷ total impressions.
- City and audience blocks with fewer than 50 users are too small to state in the PDF; mention only the count of cities.

## 2. GA4 detailed exports (preferred once tracking is confirmed)
Traffic acquisition by channel group and by source/medium; Pages and screens; Landing pages; Country and City; Device category; Key events by month; Users over time (monthly). 12 months, with prior-period comparison where available.
Script: none yet; read the CSV with pandas and write claims by hand, quoting the figure and file name.

## 3. Search Console exports (Performance → Export)
Queries and Pages, 16 months, with clicks, impressions, CTR and position.
Script: `python scripts/import_gsc.py --queries <queries.csv> --pages <pages.csv> --out gsc-facts.json`
Facts produced: totals, branded share, top non-brand queries, pages ranking in positions 4 to 15 with high impressions (the "page one or two" list), blog versus service page split.

## 4. Google reviews (no upload; fetched during the run)
Use the `places_search` tool with the client's business name and address, and once for each competitor that passed the competitor test. It returns Google rating, review count, hours and a sample of recent reviews.
Rules:
- Rating and review count are `stated` with "Google Business Profile, retrieved <date>" as the source, and a saved page is not required; record the tool result in the claim note.
- Review text is a sample of five, so themes from it never go in the PDF; they become questions. If the user supplies a full reviews export (Google Business Profile → Reviews → download, or a third-party export with at least 10 reviews), the 30% rule in evidence-rules applies and a theme may be stated.
- Never quote or name a reviewer. Paraphrase.
- Display Google-sourced facts in text; if a map is shown it must come from `places_map_display_v0`.

## 5. Social snapshot (manual, public view)
Template: `assets/social-snapshot.xlsx`, one row per platform per brand. Fill from a logged-in browser for the client and each competitor: followers, posts in last 30 days, date of last post, likes, comments, shares and views on the last 10 posts, formats used, bio link works.
Script: `python scripts/import_social.py --xlsx <file> --out social-facts.json`
Facts produced: per brand and platform, followers, posting cadence per month, average interactions per post, engagement rate (interactions ÷ followers), days since last post, formats.
Rules: engagement rate only when 10 posts are recorded; "inactive" only when the last post is dated and older than 90 days; competitors only if they passed the competitor test. Source is "public profile snapshot, <date>", evidence `stated`.

## 6. LinkedIn analytics exports (client access)
A personal profile or company page export (`AggregateAnalytics_<name>_<from>_<to>.xlsx`) with sheets DISCOVERY, ENGAGEMENT, TOP POSTS, FOLLOWERS, AUDIENCE DEMOGRAPHICS.
Script: `python scripts/import_linkedin_profile.py --xlsx <file> --out li-facts.json`
Facts produced: impressions, members reached, engagements, followers and new followers, posts by month, median engagements per post, peak month, audience seniority, job titles, locations and company sizes.
Rules: say which it is (the founder's profile or the company page) in every statement; demographics percentages are stated as exported; a month-level posting pattern may be stated when the TOP POSTS sheet lists at least 10 posts.

### LinkedIn Page analytics (company page, admin view)
Visitors, Followers, Content and Competitors tabs, each exports to XLS. The Competitors export carries follower totals and engagement for pages the client added; it is the most defensible competitor social data.
Script: none yet; read with pandas and write claims quoting the figure and file.

## 7. Meta Ads Manager export (campaign report)
Ads Manager → Reports → Export (xlsx with a "Raw Data Report" sheet, or CSV) with campaign and ad set rows: reach, impressions, frequency, results, amount spent, cost per result, dates.
Script: `python scripts/import_meta_ads.py --file <export> --out meta-facts.json`
Facts produced: per campaign and ad set, spend, reach, impressions, frequency, results and cost per result; totals; schedule dates.
Rules: results are what Meta reports and are labelled as such ("Meta reports 7 website leads"). When GA4 shows a different count for the same period, state both and raise a question about pixel and event setup; do not pick one. Google Ads and LinkedIn Ads exports follow the same pattern (read with pandas, quote the figure and file).

## 8. Meta Business Suite and X analytics exports
Reach, engagement, follower growth, top posts, audience by city. Read with pandas; write claims quoting the figure and file.

## Report sections these feed
- `search`: Search demand (from 1 or 3)
- `analytics`: Website performance (from 2, only when tracking is confirmed)
- `reviews`: Reputation (from 4)
- `ads`: Paid media (from 7)
- `social`: Social presence (from 5, 6, 8)
Each number in these sections must appear in a claim whose quote is the figure as exported, for example `"quote": "Organic Google Search clicks 419"`. Save a text version of each uploaded file with `save_page.py` using the file name as the URL (for example `file://ga4-generate-leads-overview.csv`) so quote verification can run against it.
