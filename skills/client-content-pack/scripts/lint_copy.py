#!/usr/bin/env python3
"""Check copy against the writing rules: no dashes used as pauses, no banned words, length limits, plain reading level.

Usage:
  python scripts/lint_copy.py --type blog     --file blog.md   [--profile client-profile.json]
  python scripts/lint_copy.py --type posts    --file posts.json
  python scripts/lint_copy.py --type creative --file copy.json
Exit code 0 = no failures (warnings may be listed). 1 = at least one failure. Prints JSON.
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DASH_CHARS = {"\u2014": "em dash", "\u2013": "en dash", "\u2015": "horizontal bar", "\u2012": "figure dash"}
CREATIVE_LIMITS = {"eyebrow": 24, "heading": 40, "description": 80}
POST_LIMITS = {"facebook": 200, "linkedin": 240, "instagram": 140}
HASHTAG_MAX = {"facebook": 1, "linkedin": 2, "instagram": 3}
EMOJI_MAX = {"facebook": 1, "linkedin": 0, "instagram": 1}
EMOJI_RE = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF\U0001F000-\U0001F2FF\u2B50\u2B06\u2194-\u21AA]")


def load_banned(extra=None):
    words = []
    with open(os.path.join(HERE, "..", "references", "banned-words.txt"), encoding="utf-8") as f:
        for line in f:
            line = line.strip().lower()
            if line and not line.startswith("#"):
                words.append(line)
    words += [w.lower() for w in (extra or [])]
    pats = []
    for w in words:
        if w.endswith("*"):
            pats.append((w, re.compile(r"\b" + re.escape(w[:-1]) + r"\w*", re.I)))
        else:
            pats.append((w, re.compile(r"(?<!\w)" + re.escape(w) + r"(?!\w)", re.I)))
    return pats


def common_checks(text, label, banned, fails, warns):
    for ch, name in DASH_CHARS.items():
        for m in re.finditer(ch, text):
            fails.append(f"{label}: {name} found near '{text[max(0, m.start() - 25):m.end() + 25].strip()}'")
    if re.search(r"--", text):
        fails.append(f"{label}: double hyphen used as a dash")
    for m in re.finditer(r"\s-\s", text):
        warns.append(f"{label}: spaced hyphen used like a dash near '{text[max(0, m.start() - 20):m.end() + 20].strip()}'")
    for w, pat in banned:
        for m in pat.finditer(text):
            fails.append(f"{label}: banned word or phrase '{m.group(0)}' near '{text[max(0, m.start() - 25):m.end() + 25].strip()}'")
    if re.search(r"\bnot (?:just|only|merely) [^.?!]{0,60}\bbut\b", text, re.I):
        fails.append(f"{label}: 'not just ... but' pattern")
    if re.search(r"\b(?:it|this) (?:is|'s) not about\b", text, re.I):
        fails.append(f"{label}: 'it is not about' pattern")


def syllables(word):
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w: return 0
    if len(w) <= 3: return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def sentences(text):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])", text.strip())
    return [p for p in parts if p.strip()]


def grade(text):
    ss = sentences(text); ws = re.findall(r"[A-Za-z']+", text)
    if not ss or not ws: return 0.0
    return 0.39 * len(ws) / len(ss) + 11.8 * sum(syllables(w) for w in ws) / len(ws) - 15.59


def strip_md(t):
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"[*_`>#|]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def parse_blog(raw):
    fm, body = {}, raw
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", raw, re.S)
    if m:
        for line in m.group(1).split("\n"):
            if ":" in line:
                k, v = line.split(":", 1); fm[k.strip()] = v.strip().strip('"\'')
        body = raw[m.end():]
    return fm, body


def check_blog(raw, profile, banned):
    fails, warns = [], []
    fm, body = parse_blog(raw)
    for k in ("title", "slug", "meta_description", "date"):
        if not fm.get(k): fails.append(f"front matter: missing {k}")
    if len(fm.get("title", "")) > 65: warns.append(f"title is {len(fm['title'])} characters (limit 65)")
    if not fm.get("title", "").strip().endswith("?"): warns.append("title is not a question (fine if a clear statement reads better)")
    if len(fm.get("meta_description", "")) > 155: fails.append(f"meta_description is {len(fm['meta_description'])} characters (limit 155)")
    scan = re.sub(r"^---\s*$", "", raw, flags=re.M)
    common_checks(scan, "blog", banned, fails, warns)
    if "!" in raw: warns.append("blog: exclamation mark found")
    # sections
    h2_iter = list(re.finditer(r"^##\s+(.+?)\s*$", body, re.M))
    sections = []
    for i, m in enumerate(h2_iter):
        end = h2_iter[i + 1].start() if i + 1 < len(h2_iter) else len(body)
        sections.append((m.group(1), body[m.end():end].strip()))
    intro = body[:h2_iter[0].start()].strip() if h2_iter else body.strip()
    intro_p = [p for p in re.split(r"\n\s*\n", intro) if p.strip() and not p.strip().startswith("#")]
    short = strip_md(intro_p[0]) if intro_p else ""
    sw = len(short.split())
    if not short: fails.append("missing short answer: the first paragraph after the front matter")
    elif sw < 35 or sw > 70: warns.append(f"short answer is {sw} words (aim for 35 to 70)")
    names = [s for s in sections if s[0].lower() not in ("sources", "quick answers")]
    q = [s for s in names if s[0].strip().endswith("?")]
    if names and len(q) / len(names) < 0.7: warns.append(f"only {len(q)} of {len(names)} subheadings are questions (aim for 70% or more)")
    if len(names) < 3: warns.append(f"only {len(names)} question sections (aim for 3 to 5)")
    for title, content in names:
        paras = [p for p in re.split(r"\n\s*\n", content) if p.strip()]
        if paras:
            first = strip_md(paras[0]); fw = len(first.split())
            if fw > 60 and not re.match(r"^\s*(?:[-*]|\d+\.)", paras[0]): warns.append(f"section '{title}': opening paragraph is {fw} words; answer in the first sentence and keep it short")
            fs = sentences(first)
            if fs and len(fs[0].split()) > 28: warns.append(f"section '{title}': first sentence is {len(fs[0].split())} words")
        for p in paras:
            if p.lstrip().startswith(("-", "*", "|", "###")) or re.match(r"^\d+\.", p.lstrip()): continue
            pw = len(strip_md(p).split())
            if pw > 70: warns.append(f"section '{title}': a paragraph is {pw} words (limit 70)")
        if re.match(r"^(?:it|this|that|they|these|those)\b", strip_md(paras[0]) if paras else "", re.I):
            warns.append(f"section '{title}': starts with a pronoun; name the subject so the passage works alone")
    # faq
    faq = [s for s in sections if s[0].lower() == "quick answers"]
    if not faq: warns.append("no 'Quick answers' section for FAQ markup")
    else:
        qs = re.findall(r"^###\s+(.+?)\s*$", faq[0][1], re.M)
        if len(qs) < 3: warns.append(f"Quick answers has {len(qs)} questions (aim for 3 to 5)")
        for blk in re.split(r"^###\s+.+$", faq[0][1], flags=re.M)[1:]:
            n = len(strip_md(blk).split())
            if n > 45: warns.append(f"a quick answer is {n} words (limit about 40)")
    # length, reading level, sentence length
    text_only = strip_md("\n".join(c for t, c in sections if t.lower() != "sources") + "\n" + intro)
    wc = len(text_only.split())
    if wc < 380 or wc > 950: warns.append(f"body is {wc} words (aim for 400 to 900)")
    ss = sentences(text_only)
    if ss:
        avg = sum(len(s.split()) for s in ss) / len(ss)
        if avg > 18: warns.append(f"average sentence is {avg:.1f} words (aim for 18 or fewer)")
        long_ = [s for s in ss if len(s.split()) > 28]
        if long_: warns.append(f"{len(long_)} sentence(s) over 28 words, for example: '{long_[0][:80]}...'")
    g = grade(text_only)
    if g > 8.5: warns.append(f"reading grade about {g:.1f} (aim for 8 or lower)")
    has_sources = any(s[0].lower() == "sources" for s in sections)
    if re.search(r"\d", text_only) and not has_sources: warns.append("numbers appear but there is no Sources section; remove the numbers or add sources")
    if profile:
        nm = profile.get("client", {}).get("name", "")
        if nm:
            if nm.lower() not in short.lower(): warns.append(f"business name '{nm}' is not in the short answer")
            if raw.lower().count(nm.lower()) < 2: warns.append("business name appears fewer than twice")
        urls = [s.get("url") for s in profile.get("services", []) if s.get("url")]
        if urls and not any(u in raw for u in urls): warns.append("no link to a service page from the profile")
    stats = {"words": wc, "reading_grade": round(g, 1), "short_answer_words": sw, "question_sections": f"{len(q)}/{len(names)}"}
    return fails, warns, stats


def check_posts(posts, banned):
    fails, warns = [], []
    for plat, limit in POST_LIMITS.items():
        t = posts.get(plat)
        if not t: fails.append(f"{plat}: missing"); continue
        tags = re.findall(r"#\w+", t)
        body = re.sub(r"\{link\}", "", t); body = re.sub(r"#\w+", "", body); body = re.sub(r"\s+", " ", body).strip()
        if len(body) > limit: fails.append(f"{plat}: {len(body)} characters (limit {limit})")
        if len(tags) > HASHTAG_MAX[plat]: fails.append(f"{plat}: {len(tags)} hashtags (limit {HASHTAG_MAX[plat]})")
        if len(EMOJI_RE.findall(t)) > EMOJI_MAX[plat]: fails.append(f"{plat}: too many emoji (limit {EMOJI_MAX[plat]})")
        if plat in ("facebook", "linkedin") and "{link}" not in t: warns.append(f"{plat}: no {{link}} placeholder")
        if plat == "instagram" and "link in bio" not in t.lower(): warns.append("instagram: add 'Link in bio.'")
        if t.count("!") > (1 if plat == "instagram" else 0): fails.append(f"{plat}: exclamation marks")
        common_checks(t, plat, banned, fails, warns)
    if len({re.sub(r"\W+", "", posts.get(p, "").lower()) for p in POST_LIMITS}) < 3:
        warns.append("two platforms share the same text; give each its own wording")
    return fails, warns, {p: len(re.sub(r"\s+", " ", re.sub(r"#\w+|\{link\}", "", posts.get(p, ""))).strip()) for p in POST_LIMITS}


def check_creative(copy, banned):
    fails, warns = [], []
    for k, limit in CREATIVE_LIMITS.items():
        v = (copy.get(k) or "").strip()
        if not v: fails.append(f"{k}: missing"); continue
        if len(v) > limit: fails.append(f"{k}: {len(v)} characters (limit {limit})")
        common_checks(v, k, banned, fails, warns)
        if "!" in v: fails.append(f"{k}: exclamation mark")
        if re.search(r"https?://|www\.|#\w", v): fails.append(f"{k}: no links or hashtags on the image")
    extra = set(copy) - set(CREATIVE_LIMITS)
    if extra: fails.append(f"only eyebrow, heading and description are allowed; found {sorted(extra)}")
    if copy.get("heading", "").strip().lower() == copy.get("description", "").strip().lower(): warns.append("description repeats the heading")
    return fails, warns, {k: len((copy.get(k) or "")) for k in CREATIVE_LIMITS}


def run(kind, path, profile_path=None):
    profile = json.load(open(profile_path, encoding="utf-8")) if profile_path else None
    banned = load_banned((profile or {}).get("banned_words"))
    if kind == "blog":
        return check_blog(open(path, encoding="utf-8").read(), profile, banned)
    data = json.load(open(path, encoding="utf-8"))
    return check_posts(data, banned) if kind == "posts" else check_creative(data, banned)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", required=True, choices=["blog", "posts", "creative"]); ap.add_argument("--file", required=True); ap.add_argument("--profile")
    a = ap.parse_args()
    fails, warns, stats = run(a.type, a.file, a.profile)
    print(json.dumps({"file": a.file, "type": a.type, "status": "FAIL" if fails else "PASS", "failures": fails, "warnings": warns, "stats": stats}, indent=2, ensure_ascii=False))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
