# Blog rules

The blog must be easy for people to read and easy for answer engines and AI agents to quote. Both want the same thing: a clear question, a direct answer, short passages that make sense on their own.

## Structure
1. **Title.** A plain question or a clear statement, under 65 characters. Put the main question in it. Example: "How do I prepare my lawn for winter in Toronto?"
2. **Short answer.** The first paragraph, 35 to 70 words. It answers the title question completely. Name the business and the place once. A reader who stops here has what they came for.
3. **Sections.** Each subheading (H2) is a question a real person would type or ask out loud. Each section opens with a one-sentence direct answer, then two to four short sentences that add the how or why. Every section must make sense if it is quoted alone, so use the subject's name instead of "it" or "this" at the start.
4. **Lists and tables.** Use a numbered list for steps and a bullet list for options. Use a small table only to compare things. Skip them if the answer is one sentence.
5. **Quick answers.** The last H2 is "Quick answers". It holds three to five H3 questions, each followed by an answer of 40 words or fewer. These feed the FAQ markup.
6. **Next step.** One short paragraph with the client's call to action and a link to the matching service page. No pressure, no hype.
7. **Sources.** List links for any fact, number, law, price or date you did not get from the client. If there are none, leave the section out and avoid numbers in the text.

## Length and reading level
- 400 to 900 words. Shorter is fine if the question is simple.
- Paragraphs of one to three sentences. Sentences under 20 words on average.
- Reading grade 8 or lower. Plain words. Say "use", not "utilize". Say "help", not "facilitate".
- Write to one person ("you"). Use "we" sparingly. Name the business in the short answer and in the next step.

## Voice
- No em dashes or en dashes anywhere. Use a full stop or a comma.
- No words from `banned-words.txt`. The lint script fails the draft if one slips in.
- No filler openers ("In this article", "Let's explore", "Are you looking for"). Start with the answer.
- No "not just X, but Y" or "whether you are X or Y" patterns.
- No exclamation marks. No rhetorical questions inside paragraphs. Questions belong in subheadings.
- Be specific: places, services, steps, seasons. Avoid claims you cannot support.

## Facts
- Use only facts from the client profile, from provided data, or from a source you can link.
- Do not invent statistics, awards, years in business, prices, guarantees or customer counts.
- General practical advice (how to rake leaves) is fine without a source. Laws, prices, dates and numbers need one.
- If you search the web to check a fact, cite the page in Sources.

## Answer engine and agent features
- Front matter: `title`, `slug` (question words, hyphenated), `meta_description` (under 155 characters, answers the question), `date`.
- `scripts/build_blog.py` turns the Markdown into semantic HTML with Article, FAQPage and Organization markup (JSON-LD). Do not hand-write the markup.
- Keep the business name, services and place names consistent with the client profile on every page.
- Show a visible byline and last updated date (the build script adds them from the profile and front matter).
- One main question per post. Link to the matching service page from the next step.
