#!/usr/bin/env python3
"""Turn the blog Markdown into semantic HTML with Article, FAQPage and Organization markup (JSON-LD).

Usage: python scripts/build_blog.py --md blog.md --profile client-profile.json --out DIR [--url https://client.com/blog/slug]
Writes DIR/blog.html and DIR/blog.schema.json. The Markdown file stays the clean agent-readable copy.
"""
import argparse, html, json, os, re, sys


def parse(raw):
    fm, body = {}, raw
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", raw, re.S)
    if m:
        for line in m.group(1).split("\n"):
            if ":" in line:
                k, v = line.split(":", 1); fm[k.strip()] = v.strip().strip('"\'')
        body = raw[m.end():]
    return fm, body.strip() + "\n"


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(m.group(2), quote=True)}">{m.group(1)}</a>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    return t


def plain(t):
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"[*_`]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def md_to_html(body):
    out, lines, i, first_p = [], body.split("\n"), 0, True
    while i < len(lines):
        ln = lines[i]
        if not ln.strip(): i += 1; continue
        m = re.match(r"^(#{2,3})\s+(.+)$", ln)
        if m:
            lvl = len(m.group(1)); out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>"); i += 1; continue
        if re.match(r"^\s*[-*]\s+", ln):
            items = []
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                items.append(re.sub(r"^\s*[-*]\s+", "", lines[i])); i += 1
            out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ul>"); continue
        if re.match(r"^\s*\d+\.\s+", ln):
            items = []
            while i < len(lines) and re.match(r"^\s*\d+\.\s+", lines[i]):
                items.append(re.sub(r"^\s*\d+\.\s+", "", lines[i])); i += 1
            out.append("<ol>" + "".join(f"<li>{inline(x)}</li>" for x in items) + "</ol>"); continue
        if ln.strip().startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            rows = [r for r in rows if not all(re.match(r"^:?-{2,}:?$", c) for c in r)]
            head, rest = rows[0], rows[1:]
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>" +
                       "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rest) + "</tbody></table>"); continue
        para = [ln.strip()]; i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#{2,3}\s|\s*[-*]\s|\s*\d+\.\s|\|)", lines[i]):
            para.append(lines[i].strip()); i += 1
        cls = ' class="short-answer"' if first_p else ""
        first_p = False
        out.append(f"<p{cls}>{inline(' '.join(para))}</p>")
    return "\n".join(out)


def faq_pairs(body):
    m = re.search(r"^##\s+Quick answers\s*$(.*?)(?=^##\s|\Z)", body, re.M | re.S)
    if not m: return []
    pairs = []
    for blk in re.split(r"^###\s+", m.group(1), flags=re.M)[1:]:
        q, _, a = blk.partition("\n")
        a = plain(a)
        if q.strip() and a: pairs.append((plain(q), a))
    return pairs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--md", required=True); ap.add_argument("--profile", required=True); ap.add_argument("--out", required=True); ap.add_argument("--url", default="")
    a = ap.parse_args()
    fm, body = parse(open(a.md, encoding="utf-8").read())
    prof = json.load(open(a.profile, encoding="utf-8"))
    cl, br = prof.get("client", {}), prof.get("brand", {})
    for k in ("title", "slug", "meta_description", "date"):
        if not fm.get(k): sys.exit(f"front matter missing: {k}")
    site = cl.get("website", "").rstrip("/")
    url = a.url or (f"{site}/blog/{fm['slug']}" if site else "")
    short = ""
    for p in re.split(r"\n\s*\n", body):
        if p.strip() and not p.strip().startswith("#"): short = plain(p); break
    org = {"@type": "Organization", "name": cl.get("name", ""), "url": site}
    if br.get("logo_url"): org["logo"] = {"@type": "ImageObject", "url": br["logo_url"]}
    author = prof.get("author") or {}
    article = {"@type": "Article", "headline": fm["title"][:110], "description": fm["meta_description"], "abstract": short,
               "datePublished": fm["date"], "dateModified": fm.get("updated", fm["date"]), "inLanguage": cl.get("language", "en"),
               "mainEntityOfPage": url, "publisher": org,
               "author": ({"@type": "Person", "name": author["name"], "jobTitle": author.get("role", "")} if author.get("name") else org),
               "about": [{"@type": "Thing", "name": s["name"]} for s in prof.get("services", [])[:3]]}
    graph = [article, org]
    faqs = faq_pairs(body)
    if faqs:
        graph.append({"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": ans}} for q, ans in faqs]})
    schema = {"@context": "https://schema.org", "@graph": graph}
    byline = ""
    if author.get("name"):
        byline = f"By {html.escape(author['name'])}" + (f", {html.escape(author['role'])}" if author.get("role") else "") + f", {html.escape(cl.get('name', ''))}. "
    byline += f"Updated {html.escape(fm.get('updated', fm['date']))}."
    doc = f"""<!doctype html>
<html lang="{html.escape(cl.get('language', 'en'))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(fm['title'])}</title>
<meta name="description" content="{html.escape(fm['meta_description'], quote=True)}">
{f'<link rel="canonical" href="{html.escape(url, quote=True)}">' if url else ''}
<script type="application/ld+json">
{json.dumps(schema, indent=2, ensure_ascii=False)}
</script>
</head>
<body>
<article>
<header>
<h1>{html.escape(fm['title'])}</h1>
<p class="byline">{byline}</p>
</header>
{md_to_html(body)}
</article>
</body>
</html>
"""
    os.makedirs(a.out, exist_ok=True)
    open(os.path.join(a.out, "blog.html"), "w", encoding="utf-8").write(doc)
    json.dump(schema, open(os.path.join(a.out, "blog.schema.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    print(json.dumps({"html": os.path.join(a.out, "blog.html"), "schema": os.path.join(a.out, "blog.schema.json"), "faq_questions": len(faqs), "url": url}, indent=2))


if __name__ == "__main__":
    main()
