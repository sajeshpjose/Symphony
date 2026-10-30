# Social snapshot

Fill `assets/social-snapshot.xlsx` from a logged-in browser, one row per platform per brand (client and each qualifying competitor). Ten minutes per brand. Public view only; nothing private.

Columns: Brand, Platform, Handle, URL, Followers, Following, Total posts, Posts last 30 days, Last post date, Interactions on last 10 posts (likes, comments, shares, views as four columns), Formats (image, carousel, video, text, reel), Bio link works (yes/no), Notes, Snapshot date.

Computed by `scripts/import_social.py`:
- Posting cadence = posts in last 30 days (per month).
- Average interactions per post = (likes + comments + shares) ÷ posts counted (views listed separately).
- Engagement rate = average interactions ÷ followers, as a percentage with two decimals; only when 10 posts are counted.
- Days since last post from the snapshot date.

PDF wording: "On LinkedIn, Danburite posted 6 times in the 30 days to 29 October and averages 14 interactions per post, an engagement rate of 0.9% on 1,560 followers." Competitors in the same sentence form, then a comparison table. Never rank by quality; report the numbers.
