#!/usr/bin/env python3
"""Build the client PDF, the internal questions document and the claims ledger.

Usage:
  python scripts/build_outputs.py --data report-data.json --out /mnt/user-data/outputs \
      --brand assets/brand-config.json [--version v1]

The PDF is built only from claims that are status=included and have an allowed
evidence type. Blocks that cite anything else are rejected, and every number in
a block must appear in the claims it cites.
"""
import argparse, json, os, re, sys
from collections import OrderedDict

ALLOWED_EVIDENCE = {"stated", "corroborated", "client_confirmed", "observed_absence"}
SECTION_ORDER_V1 = ["summary", "overview", "offerings", "aspirations", "audiences", "customers", "reviews", "search", "analytics",
                    "ads", "social", "competitors", "standout", "opportunities", "actions", "content", "market"]
SECTION_ORDER_V2 = ["summary", "overview", "offerings", "goals", "aspirations", "audiences", "profiles", "customers", "reviews", "search",
                    "analytics", "ads", "social", "competitors", "standout", "positioning", "opportunities", "actions", "content", "market", "plan"]


def slugify(s):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.strip().lower()).strip("-")
    return s or "client"


def norm_num(tok):
    return re.sub(r"[,\s]", "", tok)


NUM_RE = re.compile(r"(?<![A-Za-z\d])\d[\d,]*(?:\.\d+)?(?![A-Za-z])")


WORDS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
         "ten": "10", "eleven": "11", "twelve": "12"}


def numbers_in(text, words=False):
    """Digits in text; with words=True also number words (used for the claim side only, so 'six services' allows a '6')."""
    found = {norm_num(t).rstrip(".") for t in NUM_RE.findall(text or "")}
    if words:
        for w, d in WORDS.items():
            if re.search(r"\b" + w + r"\b", (text or "").lower()):
                found.add(d)
    return found


class BuildError(Exception):
    pass


def norm_text(t):
    t = (t or "").lower().replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    t = re.sub(r"[\u2013\u2014]", "-", t)
    return re.sub(r"[^a-z0-9'\"$%.-]+", " ", t).strip()


def load_pages(pages_dir):
    pages = {}
    if not pages_dir or not os.path.isdir(pages_dir):
        return pages
    for f in os.listdir(pages_dir):
        with open(os.path.join(pages_dir, f), encoding="utf-8", errors="replace") as fh:
            url = fh.readline().strip(); pages[url.rstrip("/")] = norm_text(fh.read())
    return pages


def verify_quotes(data, pages, strict):
    """Every included stated/corroborated claim with a quote must be found in the saved text of its source page."""
    problems = []
    for c in data.get("claims", []):
        if c.get("status") != "included" or c.get("evidence") not in ("stated", "corroborated"):
            continue
        url = (c.get("source_url") or "").rstrip("/")
        if url.startswith("google-business-profile") or c.get("source_title", "").lower().startswith("google business profile"):
            continue  # places_search results have no page to save; the tool result is recorded in the claim note
        q = norm_text(c.get("quote"))
        if not q:
            problems.append(f"{c['id']}: included {c['evidence']} claim has no supporting quote"); continue
        if url not in pages:
            problems.append(f"{c['id']}: no saved page for {url or '(empty url)'}; save it with scripts/save_page.py"); continue
        if q not in pages[url]:
            problems.append(f"{c['id']}: quote not found in saved page text: '{c.get('quote')}'")
    if problems and strict:
        raise BuildError("quote verification failed:\n  " + "\n  ".join(problems))
    return problems


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def claim_index(data):
    idx = {}
    for c in data.get("claims", []):
        if c["id"] in idx:
            raise BuildError(f"Duplicate claim id {c['id']}")
        if len((c.get("quote") or "").split()) >= 15:
            raise BuildError(f"Claim {c['id']}: supporting quote must be under 15 words")
        idx[c["id"]] = c
    return idx


def check_refs(ids, idx, where, text, structural=False):
    """Validate claim references and numbers for one block or cell."""
    if not ids:
        if not structural:
            raise BuildError(f"{where}: no claim_ids. Cite claims or mark the block structural.")
        if re.search(r"\d", text or ""):
            raise BuildError(f"{where}: structural text may not contain digits: {text!r}")
        return
    allowed_numbers = set()
    for cid in ids:
        c = idx.get(cid)
        if c is None:
            raise BuildError(f"{where}: unknown claim {cid}")
        if c.get("status") != "included":
            raise BuildError(f"{where}: claim {cid} has status {c.get('status')!r}, not 'included'")
        if c.get("evidence") not in ALLOWED_EVIDENCE:
            raise BuildError(f"{where}: claim {cid} has evidence {c.get('evidence')!r}, not allowed in the client PDF")
        allowed_numbers |= numbers_in(c.get("text", ""), words=True) | numbers_in(c.get("quote", ""), words=True)
    missing = numbers_in(text) - allowed_numbers
    if missing:
        raise BuildError(f"{where}: numbers {sorted(missing)} do not appear in cited claims {ids}")


def validate_sections(data, idx):
    ok = []
    for s in data.get("sections", []):
        blocks = []
        for i, b in enumerate(s.get("blocks", [])):
            w = f"section {s.get('key')} block {i + 1} ({b.get('type')})"
            t = b.get("type")
            if t in ("paragraph", "callout"):
                check_refs(b.get("claim_ids", []), idx, w, (b.get("title", "") + " " + b.get("text", "")), b.get("structural", False))
            elif t == "bullets":
                for j, it in enumerate(b.get("items", [])):
                    check_refs(it.get("claim_ids", []), idx, f"{w} item {j + 1}", it.get("text", ""), it.get("structural", False))
            elif t == "facts":
                for j, it in enumerate(b.get("items", [])):
                    check_refs(it.get("claim_ids", []), idx, f"{w} fact {j + 1}", it.get("label", "") + " " + it.get("value", ""), False)
            elif t == "chart":
                if b.get("kind") not in ("bar", "column", "line"):
                    raise BuildError(f"{w}: chart kind must be bar, column or line")
                series = b.get("series") or [{"name": "", "items": b.get("items", [])}]
                for sname, ser in enumerate(series):
                    for j, it in enumerate(ser.get("items", [])):
                        val = it.get("value")
                        check_refs(it.get("claim_ids", []), idx, f"{w} series {sname + 1} point {j + 1}", f"{it.get('label', '')} {val}", False)
                if b.get("title"):
                    check_refs(b.get("claim_ids", []), idx, f"{w} title", b.get("title", "") + " " + b.get("caption", ""), not b.get("claim_ids"))
            elif t == "table":
                for r, row in enumerate(b.get("rows", [])):
                    for c, cell in enumerate(row):
                        if isinstance(cell, str):
                            raise BuildError(f"{w} row {r + 1} col {c + 1}: table cells must be objects with text and claim_ids")
                        check_refs(cell.get("claim_ids", []), idx, f"{w} row {r + 1} col {c + 1}", cell.get("text", ""), cell.get("structural", False))
            else:
                raise BuildError(f"{w}: unknown block type")
            if s.get("key") in ("opportunities", "standout"):
                ids = set(b.get("claim_ids", [])) | {i for it in b.get("items", []) for i in it.get("claim_ids", [])} | {i for row in b.get("rows", []) for cell in row for i in cell.get("claim_ids", [])} | {i for ser in b.get("series", []) for it in ser.get("items", []) for i in it.get("claim_ids", [])}
                if ids and all(idx[i].get("evidence") == "observed_absence" for i in ids):
                    raise BuildError(f"{w}: an opportunity or standout point cannot rest on an observed absence alone; cite a competitor or stated fact as well")
            blocks.append(b)
        if blocks:
            ok.append({**s, "blocks": blocks})
    return ok


def order_sections(sections, version):
    order = SECTION_ORDER_V2 if version != "v1" else SECTION_ORDER_V1
    rank = {k: i for i, k in enumerate(order)}
    return sorted(sections, key=lambda s: rank.get(s.get("key"), 999))


def cited_sources(data, sections):
    idx = claim_index(data)
    used = OrderedDict()
    def collect(ids):
        for cid in ids:
            c = idx.get(cid)
            if c and c.get("source_url"):
                used[c["source_url"]] = c.get("source_title", "")
    for s in sections:
        for b in s["blocks"]:
            collect(b.get("claim_ids", []))
            for it in b.get("items", []):
                collect(it.get("claim_ids", []))
            for row in b.get("rows", []):
                for cell in row:
                    collect(cell.get("claim_ids", []))
            for ser in b.get("series", []):
                for it in ser.get("items", []):
                    collect(it.get("claim_ids", []))
    meta = {s["url"]: s for s in data.get("sources", [])}
    out = []
    for url, title in used.items():
        m = meta.get(url, {})
        out.append({"url": url, "title": m.get("title") or title or url, "fetched": m.get("fetched", data.get("date", "")), "type": m.get("type", "")})
    return out


# ---------------------------------------------------------------- PDF
FONT_DIRS = ["/usr/share/fonts/truetype/google-fonts", "/usr/share/fonts/truetype/liberation", "/usr/share/fonts/truetype/dejavu"]


def register_fonts(brand):
    """Register heading and body fonts; fall back to Helvetica when files are missing."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    def find(name):
        for d in FONT_DIRS:
            p = os.path.join(d, name)
            if os.path.exists(p):
                return p
        return None

    fonts = {"h_light": "Helvetica", "h_reg": "Helvetica", "h_med": "Helvetica-Bold", "h_bold": "Helvetica-Bold",
             "b_reg": "Helvetica", "b_bold": "Helvetica-Bold", "b_ital": "Helvetica-Oblique"}
    sets = {"Poppins": [("h_light", "Poppins-Light.ttf"), ("h_reg", "Poppins-Regular.ttf"), ("h_med", "Poppins-Medium.ttf"), ("h_bold", "Poppins-Bold.ttf")],
            "Liberation Sans": [("b_reg", "LiberationSans-Regular.ttf"), ("b_bold", "LiberationSans-Bold.ttf"), ("b_ital", "LiberationSans-Italic.ttf")],
            "DejaVu Sans": [("b_reg", "DejaVuSans.ttf"), ("b_bold", "DejaVuSans-Bold.ttf"), ("b_ital", "DejaVuSans-Oblique.ttf")]}
    for fam in (brand.get("heading_font", "Poppins"), brand.get("body_font", "Liberation Sans")):
        for key, fname in sets.get(fam, []):
            path = find(fname)
            if path:
                reg = fam.replace(" ", "") + "-" + key
                pdfmetrics.registerFont(TTFont(reg, path))
                fonts[key] = reg
    return fonts


def draw_logo(canv, x, y, size, color, bg):
    """The yello mark as vector paths: a square with a rounded bottom-left corner and a
    four-point star (arcs centred on the four corners) in the background colour."""
    canv.saveState()
    r = size / 2.0
    k = 0.5523 * r
    p = canv.beginPath()
    p.moveTo(x, y + size); p.lineTo(x + size, y + size); p.lineTo(x + size, y); p.lineTo(x + r, y)
    p.curveTo(x + r - k, y, x, y + r - k, x, y + r)
    p.close()
    canv.setFillColor(color); canv.drawPath(p, fill=1, stroke=0)
    cx, cy = x + r, y + r
    q = canv.beginPath()
    q.moveTo(cx, y + size)
    q.curveTo(cx, y + size - k, x + size - k, cy, x + size, cy)
    q.curveTo(x + size - k, cy, cx, y + k, cx, y)
    q.curveTo(cx, y + k, x + k, cy, x, cy)
    q.curveTo(x + k, cy, cx, y + size - k, cx, y + size)
    q.close()
    canv.setFillColor(bg); canv.drawPath(q, fill=1, stroke=0)
    canv.restoreState()


def build_pdf(data, sections, brand, path, version):
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
                                    Table, TableStyle, KeepTogether, NextPageTemplate, ListFlowable, ListItem, CondPageBreak, Flowable)

    F = register_fonts(brand)
    clean = lambda t: (t or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    hexc = lambda h: colors.HexColor(h)
    primary, accent = hexc(brand["primary_color"]), hexc(brand["accent_color"])
    text_c, muted, rule = hexc(brand["text_color"]), hexc(brand["muted_color"]), hexc(brand.get("rule_color", "#DDDBD6"))
    soft = hexc("#B9B9B9")
    W, H = letter
    M = 1.0 * inch
    client = data["client"]["name"]
    agency = brand["agency_name"]
    avail = W - 2 * M

    st = {
        "h1": ParagraphStyle("h1", fontName=F["h_med"], fontSize=24, leading=30, textColor=primary, spaceAfter=18),
        "p": ParagraphStyle("p", fontName=F["b_reg"], fontSize=10.5, leading=17, textColor=text_c, spaceAfter=10),
        "lead": ParagraphStyle("lead", fontName=F["h_light"], fontSize=14, leading=22, textColor=primary, spaceAfter=14),
        "cell": ParagraphStyle("cell", fontName=F["b_reg"], fontSize=9.5, leading=13.5, textColor=text_c),
        "cellh": ParagraphStyle("cellh", fontName=F["h_med"], fontSize=8.5, leading=12, textColor=primary),
        "small": ParagraphStyle("small", fontName=F["b_reg"], fontSize=8.5, leading=12, textColor=muted),
        "co_t": ParagraphStyle("co_t", fontName=F["h_med"], fontSize=9, leading=12, textColor=muted, spaceAfter=4),
        "co_p": ParagraphStyle("co_p", fontName=F["h_light"], fontSize=13.5, leading=20, textColor=primary),
        "fact_v": ParagraphStyle("fact_v", fontName=F["h_light"], fontSize=22, leading=26, textColor=primary),
        "fact_l": ParagraphStyle("fact_l", fontName=F["h_med"], fontSize=8, leading=11, textColor=muted),
        "toc": ParagraphStyle("toc", fontName=F["b_reg"], fontSize=11, leading=26, textColor=text_c),
        "tocn": ParagraphStyle("tocn", fontName=F["h_light"], fontSize=11, leading=26, textColor=muted),
        "tocr": ParagraphStyle("tocr", fontName=F["h_light"], fontSize=11, leading=26, textColor=muted, alignment=2),
    }

    page_of = {}

    class SectionHead(Flowable):
        """Large muted section number, a short accent rule, then the title. Records its page."""
        def __init__(self, number, title):
            Flowable.__init__(self); self.number = number; self.title = title
        def wrap(self, aw, ah): return aw, 72
        def draw(self):
            c = self.canv
            page_of[self.number] = c.getPageNumber()
            c.setFont(F["h_light"], 30); c.setFillColor(muted); c.drawString(0, 40, f"{self.number:02d}")
            c.setFillColor(accent); c.rect(0, 30, 22, 1.6, stroke=0, fill=1)
            c.setFont(F["h_med"], 24); c.setFillColor(primary); c.drawString(0, 4, self.title)

    def wrap_title(t, width):
        words, lines, cur = t.split(), [], ""
        for w in words:
            if len(cur) + len(w) + 1 > width and cur:
                lines.append(cur); cur = w
            else:
                cur = (cur + " " + w).strip()
        if cur: lines.append(cur)
        return lines[:3]

    def body_page(canv, doc):
        canv.saveState()
        canv.setStrokeColor(rule); canv.setLineWidth(0.5)
        canv.line(M, H - 0.72 * inch, W - M, H - 0.72 * inch)
        canv.setFont(F["b_reg"], 8); canv.setFillColor(muted)
        canv.drawString(M, H - 0.62 * inch, client)
        canv.drawRightString(W - M, H - 0.62 * inch, "Brand Intelligence Report")
        draw_logo(canv, M, 0.46 * inch, 11, primary, colors.white)
        canv.drawRightString(W - M, 0.48 * inch, str(doc.page))
        canv.restoreState()

    def cover_page(canv, doc):
        canv.saveState()
        canv.setFillColor(primary); canv.rect(0, 0, W, H, stroke=0, fill=1)
        draw_logo(canv, M, H - M - 0.55 * inch, 0.55 * inch, colors.white, primary)
        canv.setFont(F["h_light"], 12); canv.setFillColor(soft); canv.drawString(M, H - 3.6 * inch, "Brand Intelligence Report")
        canv.setFont(F["h_light"], 36); canv.setFillColor(colors.white)
        y = H - 4.35 * inch
        for line in wrap_title(client, 22):
            canv.drawString(M, y, line); y -= 0.6 * inch
        canv.setFillColor(accent); canv.rect(M, y + 0.12 * inch, 0.45 * inch, 2, stroke=0, fill=1)
        canv.setFont(F["b_reg"], 10.5); canv.setFillColor(soft)
        yy = y - 0.35 * inch
        for line in [m for m in (data["client"].get("url", ""), data["client"].get("location", ""), data["client"].get("industry", "")) if m]:
            canv.drawString(M, yy, line); yy -= 0.26 * inch
        canv.drawString(M, M, f"Version {version.replace('v', '')}  |  {data.get('date', '')}")
        canv.drawRightString(W - M, M, "Confidential. Prepared for " + client)
        canv.restoreState()

    def back_page(canv, doc):
        canv.saveState()
        canv.setFillColor(primary); canv.rect(0, 0, W, H, stroke=0, fill=1)
        draw_logo(canv, M, H / 2 + 0.3 * inch, 0.9 * inch, colors.white, primary)
        canv.setFillColor(accent); canv.rect(M, H / 2 - 0.05 * inch, 0.45 * inch, 2, stroke=0, fill=1)
        canv.setFont(F["b_reg"], 11); canv.setFillColor(soft)
        if brand.get("website"): canv.drawString(M, H / 2 - 0.45 * inch, brand["website"])
        if brand.get("contact_email"): canv.drawString(M, H / 2 - 0.71 * inch, brand["contact_email"])
        canv.setFont(F["b_reg"], 8.5)
        canv.drawString(M, M, f"Prepared for {client}. Based on publicly available information reviewed on {data.get('date', '')}.")
        canv.restoreState()

    def make_table(rows, widths, head=True):
        tb = Table(rows, colWidths=widths, repeatRows=1 if head else 0)
        style = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                 ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("LINEBELOW", (0, 0), (-1, -1), 0.5, rule)]
        if head: style.append(("LINEBELOW", (0, 0), (-1, 0), 1.2, primary))
        tb.setStyle(TableStyle(style))
        return tb

    def fmt(v):
        if isinstance(v, float) and not v.is_integer():
            return f"{v:,.1f}" if abs(v) >= 10 else f"{v:,.2f}"
        return f"{int(v):,}"

    def make_chart(b):
        """Bar, column or line chart drawn with reportlab graphics in the report palette (charcoal and greys, no colour)."""
        from reportlab.graphics.shapes import Drawing, String, Line, Rect, PolyLine, Circle
        from reportlab.lib import colors as rl
        series = b.get("series") or [{"name": "", "items": b.get("items", [])}]
        shades = [primary, hexc("#8C8C8C"), hexc("#C4C2BC"), hexc("#E0DEDA")]
        unit = b.get("unit", ""); kind = b["kind"]
        W_ = avail; d = Drawing(W_, 0)
        if kind == "bar":
            items = series[0]["items"]; n = len(items)
            row_h = 22; gap = 8; label_w = min(190, max(70, max(len(i["label"]) for i in items) * 5.6)); bar_max = W_ - label_w - 70
            H_ = n * (row_h + gap) + (26 if b.get("title") else 0)
            d.height = H_; top = H_ - (26 if b.get("title") else 0)
            mx = max(float(i["value"]) for i in items) or 1
            for k, it in enumerate(items):
                yy = top - (k + 1) * (row_h + gap) + gap
                hi = it.get("highlight", False)
                d.add(String(0, yy + 6, it["label"], fontName=F["b_reg"], fontSize=9, fillColor=text_c))
                wbar = float(it["value"]) / mx * bar_max
                d.add(Rect(label_w, yy, max(wbar, 1.5), row_h, fillColor=(primary if hi or n == 1 else shades[1 if not any(i.get("highlight") for i in items) else 2]), strokeColor=None))
                d.add(String(label_w + wbar + 6, yy + 6, fmt(it["value"]) + unit, fontName=F["h_med"], fontSize=9, fillColor=primary))
            if b.get("title"): d.add(String(0, H_ - 12, b["title"], fontName=F["h_med"], fontSize=10.5, fillColor=primary))
            return d
        if kind == "column":
            items0 = series[0]["items"]; n = len(items0); ns = len(series)
            H_ = 190 + (26 if b.get("title") else 0); plot_h = 120; base = 42
            d.height = H_
            mx = max(float(it["value"]) for ser in series for it in ser["items"]) or 1
            group_w = W_ / n; bw = min(34, (group_w - 12) / ns)
            d.add(Line(0, base, W_, base, strokeColor=rule, strokeWidth=0.6))
            for k in range(n):
                x0 = k * group_w + (group_w - bw * ns) / 2
                for si, ser in enumerate(series):
                    it = ser["items"][k]; h = float(it["value"]) / mx * plot_h
                    d.add(Rect(x0 + si * bw, base, bw - 2, max(h, 1), fillColor=shades[si % len(shades)] if not it.get("highlight") else primary, strokeColor=None))
                    d.add(String(x0 + si * bw + (bw - 2) / 2, base + h + 4, fmt(it["value"]) + unit, fontName=F["h_med"], fontSize=8, fillColor=primary, textAnchor="middle"))
                lab = items0[k]["label"]
                words = lab.split(); lines_ = []; cur = ""
                for wd in words:
                    if len(cur) + len(wd) + 1 > 14 and cur: lines_.append(cur); cur = wd
                    else: cur = (cur + " " + wd).strip()
                if cur: lines_.append(cur)
                for li, ln in enumerate(lines_[:3]):
                    d.add(String(k * group_w + group_w / 2, base - 14 - li * 11, ln, fontName=F["b_reg"], fontSize=8.5, fillColor=muted, textAnchor="middle"))
            if ns > 1:
                lx = 0
                for si, ser in enumerate(series):
                    d.add(Rect(lx, H_ - 10 - (26 if b.get("title") else 0), 10, 10, fillColor=shades[si % len(shades)], strokeColor=None))
                    d.add(String(lx + 14, H_ - 9 - (26 if b.get("title") else 0), ser.get("name", ""), fontName=F["b_reg"], fontSize=8.5, fillColor=muted)); lx += 20 + len(ser.get("name", "")) * 5.2
            if b.get("title"): d.add(String(0, H_ - 12, b["title"], fontName=F["h_med"], fontSize=10.5, fillColor=primary))
            return d
        # line
        H_ = 170 + (26 if b.get("title") else 0); plot_h = 110; base = 34; d.height = H_
        mx = max(float(it["value"]) for ser in series for it in ser["items"]) or 1
        n = len(series[0]["items"]); step = (W_ - 20) / max(n - 1, 1)
        d.add(Line(10, base, W_ - 10, base, strokeColor=rule, strokeWidth=0.6))
        for si, ser in enumerate(series):
            pts = []
            for k, it in enumerate(ser["items"]):
                x = 10 + k * step; yv = base + float(it["value"]) / mx * plot_h; pts += [x, yv]
                if si == 0:
                    d.add(String(x, base - 14, it["label"], fontName=F["b_reg"], fontSize=8, fillColor=muted, textAnchor="middle"))
            d.add(PolyLine(pts, strokeColor=shades[si % len(shades)], strokeWidth=1.6))
            for k, it in enumerate(ser["items"]):
                x = 10 + k * step; yv = base + float(it["value"]) / mx * plot_h
                d.add(Circle(x, yv, 2.4, fillColor=shades[si % len(shades)], strokeColor=None))
                if it.get("highlight") or k == len(ser["items"]) - 1 or float(it["value"]) == mx:
                    d.add(String(x, yv + 6, fmt(it["value"]) + unit, fontName=F["h_med"], fontSize=8, fillColor=primary, textAnchor="middle"))
        if ns := len(series) > 1:
            lx = 0
            for si, ser in enumerate(series):
                d.add(Rect(lx, H_ - 10 - (26 if b.get("title") else 0), 10, 10, fillColor=shades[si % len(shades)], strokeColor=None))
                d.add(String(lx + 14, H_ - 9 - (26 if b.get("title") else 0), ser.get("name", ""), fontName=F["b_reg"], fontSize=8.5, fillColor=muted)); lx += 20 + len(ser.get("name", "")) * 5.2
        if b.get("title"): d.add(String(0, H_ - 12, b["title"], fontName=F["h_med"], fontSize=10.5, fillColor=primary))
        return d

    def story_for(pages):
        story = [NextPageTemplate("body"), PageBreak(), Spacer(1, 0.4 * inch), Paragraph("Contents", st["h1"])]
        rows = [[Paragraph(f"{i + 1:02d}", st["tocn"]), Paragraph(clean(s["title"]), st["toc"]), Paragraph(str(pages.get(i + 1, "")), st["tocr"])]
                for i, s in enumerate(sections)]
        n_src = len(sections) + 1
        rows.append([Paragraph(f"{n_src:02d}", st["tocn"]), Paragraph("Sources and method", st["toc"]), Paragraph(str(pages.get(n_src, "")), st["tocr"])])
        toc = Table(rows, colWidths=[0.6 * inch, avail - 1.2 * inch, 0.6 * inch])
        toc.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LINEBELOW", (0, 0), (-1, -1), 0.5, rule),
                                 ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                 ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        story += [toc, Spacer(1, 0.5 * inch),
                  Paragraph(clean(f"This report sets out what we found about {client} from publicly available information, as a shared "
                                  "starting point for our work together. Every statement is drawn from the business's own channels or "
                                  "from independent sources, listed at the end."), st["small"])]

        for n, s in enumerate(sections, 1):
            if n == 1 or s.get("page_break"):
                story.append(PageBreak())
            else:
                story += [CondPageBreak(3.0 * inch), Spacer(1, 30)]
            head_group = [SectionHead(n, s["title"]), Spacer(1, 10)]
            pending_head = True
            for b in s["blocks"]:
                fl = []
                t = b["type"]
                if t == "paragraph":
                    fl.append(Paragraph(clean(b["text"]), st["lead"] if b.get("lead") else st["p"]))
                elif t == "facts":
                    cells = []
                    for it in b["items"][:4]:
                        cells.append([Paragraph(clean(it["value"]), st["fact_v"]), Paragraph(clean(it["label"]).upper(), st["fact_l"])])
                    ncol = len(cells)
                    ft = Table([[c[0] for c in cells], [c[1] for c in cells]], colWidths=[avail / ncol] * ncol)
                    ft.setStyle(TableStyle([("VALIGN", (0, 0), (-1, 0), "BOTTOM"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, 0), 10),
                                            ("BOTTOMPADDING", (0, 1), (-1, 1), 10), ("LINEABOVE", (0, 0), (-1, 0), 0.5, rule), ("LINEBELOW", (0, 1), (-1, 1), 0.5, rule)]))
                    fl += [Spacer(1, 4), ft, Spacer(1, 16)]
                elif t == "bullets":
                    items = [ListItem(Paragraph(clean(i["text"]), st["p"]), leftIndent=16) for i in b["items"]]
                    fl += [ListFlowable(items, bulletType="bullet", start="\u2013", leftIndent=16, bulletFontName=F["b_reg"], bulletFontSize=10, bulletColor=muted), Spacer(1, 4)]
                elif t == "table":
                    heads = b.get("headers", [])
                    rows = [[Paragraph(clean(h).upper(), st["cellh"]) for h in heads]] if heads else []
                    rows += [[Paragraph(clean(c["text"]), st["cell"]) for c in r] for r in b["rows"]]
                    ncol = len(rows[0])
                    fl += [Spacer(1, 6), make_table(rows, b.get("col_widths") or [avail / ncol] * ncol, bool(heads)), Spacer(1, 12)]
                elif t == "chart":
                    fl += [Spacer(1, 6), make_chart(b), Spacer(1, 10)]
                    if b.get("caption"):
                        fl.append(Paragraph(clean(b["caption"]), st["small"]))
                    fl.append(Spacer(1, 8))
                elif t == "callout":
                    inner = ([Paragraph(clean(b["title"]).upper(), st["co_t"])] if b.get("title") else []) + [Paragraph(clean(b["text"]), st["co_p"])]
                    box = Table([[inner]], colWidths=[avail])
                    box.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 1.2, primary), ("LINEBELOW", (0, -1), (-1, -1), 0.5, rule),
                                             ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 40),
                                             ("TOPPADDING", (0, 0), (-1, -1), 14), ("BOTTOMPADDING", (0, 0), (-1, -1), 14)]))
                    fl.append(KeepTogether([Spacer(1, 8), box, Spacer(1, 14)]))
                if pending_head:
                    story.append(KeepTogether(head_group + fl)); pending_head = False
                else:
                    story += fl
            if pending_head:
                story += head_group

        src = cited_sources(data, sections)
        story += [PageBreak(), SectionHead(n_src, "Sources and method"), Spacer(1, 10),
                  Paragraph(clean(f"This report is based on publicly available information reviewed on {data.get('date', '')}. "
                                  f"A statement appears only when {client} says it on its own channels or when independent sources support it. "
                                  "Business details change, so please tell us about anything that is out of date."), st["p"])]
        if src:
            rows = [[Paragraph("SOURCE", st["cellh"]), Paragraph("REVIEWED", st["cellh"])]]
            seen = set(); rows_src = []
            for x in src:
                label = x["title"] if (x["url"].startswith("google-business-profile") or x["url"].startswith("file://")) else f"{x['title']}  {x['url']}"
                if label in seen: continue
                seen.add(label); rows_src.append(x | {"label": label})
            rows += [[Paragraph(clean(x["label"]), st["cell"]), Paragraph(clean(x["fetched"]), st["cell"])] for x in rows_src]
            story += [Spacer(1, 6), make_table(rows, [avail - 1.1 * inch, 1.1 * inch])]
        story += [NextPageTemplate("back"), PageBreak(), Spacer(1, 1)]
        return story

    def new_doc():
        d = BaseDocTemplate(path, pagesize=letter, leftMargin=M, rightMargin=M, topMargin=1.05 * inch, bottomMargin=1.0 * inch,
                            title=f"Brand Intelligence Report: {client}", author=brand.get("website", ""), subject=f"Report for {client}", creator=brand.get("website", ""))
        frame = Frame(M, 1.0 * inch, avail, H - 2.05 * inch, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        d.addPageTemplates([PageTemplate(id="cover", frames=[frame], onPage=cover_page),
                            PageTemplate(id="body", frames=[frame], onPage=body_page),
                            PageTemplate(id="back", frames=[frame], onPage=back_page)])
        return d

    new_doc().build(story_for({}))          # first pass records section pages
    new_doc().build(story_for(dict(page_of)))  # second pass prints them in the contents
    return len(sections)


# ---------------------------------------------------------------- DOCX
def build_questions_docx(data, brand, path):
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    doc = Document()
    sec = doc.sections[0]
    sec.left_margin = sec.right_margin = Inches(0.9)
    sec.top_margin = sec.bottom_margin = Inches(0.9)
    base = doc.styles["Normal"]; base.font.name = "Arial"; base.font.size = Pt(10.5)
    base.element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")

    def shade(cell, hexcolor):
        tcPr = cell._tc.get_or_add_tcPr(); shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), hexcolor); tcPr.append(shd)

    # Banner
    t = doc.add_table(rows=1, cols=1); c = t.rows[0].cells[0]; shade(c, "B42318")
    p = c.paragraphs[0]; r = p.add_run("INTERNAL. DO NOT SHARE WITH THE CLIENT"); r.bold = True; r.font.size = Pt(12); r.font.color.rgb = RGBColor(255, 255, 255)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for s in doc.sections:
        fp = s.footer.paragraphs[0]; fr = fp.add_run("INTERNAL. Meeting questions for " + data["client"]["name"] + ". Not for the client."); fr.font.size = Pt(8); fr.font.color.rgb = RGBColor(0xB4, 0x23, 0x18)

    h = doc.add_paragraph(); h.paragraph_format.space_before = Pt(14)
    r = h.add_run("First meeting questions: " + data["client"]["name"]); r.bold = True; r.font.size = Pt(18)
    sub = doc.add_paragraph(); r = sub.add_run(f"{data['client'].get('url', '')}   |   Prepared {data.get('date', '')}   |   Report {data.get('version', 'v1')}")
    r.font.size = Pt(9.5); r.font.color.rgb = RGBColor(0x6A, 0x68, 0x5F)
    intro = doc.add_paragraph("Each question shows why it is being asked and what the site currently says, so you can test what we think we know. Must-ask questions are marked.")
    intro.runs[0].font.size = Pt(10)

    qs = data.get("questions", [])
    topics = OrderedDict()
    for q in qs: topics.setdefault(q.get("topic", "Other"), []).append(q)
    n = 0
    for topic, items in topics.items():
        hp = doc.add_paragraph(); hp.paragraph_format.space_before = Pt(14); hp.paragraph_format.keep_with_next = True
        r = hp.add_run(topic); r.bold = True; r.font.size = Pt(13); r.font.color.rgb = RGBColor(0x3D, 0x4F, 0xE0)
        items.sort(key=lambda q: 0 if q.get("priority") == "must" else 1)
        for q in items:
            n += 1
            tb = doc.add_table(rows=3, cols=1); tb.style = "Table Grid"
            c0 = tb.rows[0].cells[0]; shade(c0, "F0EFEA")
            p0 = c0.paragraphs[0]
            r = p0.add_run(f"{n}. {q['question']}"); r.bold = True
            tag = "  MUST ASK" if q.get("priority") == "must" else "  nice to ask"
            r2 = p0.add_run(tag); r2.font.size = Pt(8.5); r2.bold = q.get("priority") == "must"
            r2.font.color.rgb = RGBColor(0xB4, 0x23, 0x18) if q.get("priority") == "must" else RGBColor(0x6A, 0x68, 0x5F)
            c1 = tb.rows[1].cells[0]
            p1 = c1.paragraphs[0]; a = p1.add_run("Why we are asking: "); a.bold = True; a.font.size = Pt(9.5)
            b = p1.add_run(q.get("trigger", "")); b.font.size = Pt(9.5)
            p2 = c1.add_paragraph(); a = p2.add_run("What the site says: "); a.bold = True; a.font.size = Pt(9.5)
            b = p2.add_run(q.get("site_says", "")); b.font.size = Pt(9.5)
            c2 = tb.rows[2].cells[0]; pn = c2.paragraphs[0]; a = pn.add_run("Notes: "); a.bold = True; a.font.size = Pt(9.5)
            for _ in range(2): c2.add_paragraph("")
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
    doc.core_properties.title = "INTERNAL meeting questions"; doc.core_properties.author = brand["agency_name"]
    doc.save(path)
    return n


# ---------------------------------------------------------------- XLSX
def build_ledger_xlsx(data, path):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    arial = Font(name="Arial", size=10); bold = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    head = PatternFill("solid", fgColor="3D4FE0")
    fills = {"included": "E2F4EB", "question": "FBEFD9", "dropped": "FBE5E5"}
    thin = Side(style="thin", color="E4E2DB"); border = Border(bottom=thin)

    def sheet(ws, headers, rows, widths, status_col=None):
        ws.append(headers)
        for c in ws[1]: c.font = bold; c.fill = head; c.alignment = Alignment(vertical="center", wrap_text=True)
        for r in rows: ws.append(r)
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.font = arial; c.alignment = Alignment(vertical="top", wrap_text=True); c.border = border
            if status_col is not None:
                st = str(row[status_col].value)
                if st in fills: row[status_col].fill = PatternFill("solid", fgColor=fills[st])
        for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = "A2"; ws.auto_filter.ref = ws.dimensions

    ws = wb.active; ws.title = "README"
    notes = ["INTERNAL claims ledger. Do not share with the client.", "",
             f"Client: {data['client']['name']}   Report: {data.get('version', 'v1')}   Date: {data.get('date', '')}", "",
             "Status: included = appears in the client PDF; question = goes to the meeting list; dropped = conflicting or unreadable.",
             "Evidence: stated, corroborated, client_confirmed, observed_absence are allowed in the PDF. inferred and single_external are not.",
             "Use the filters on the Claims sheet to review by section, status or evidence."]
    for i, line in enumerate(notes, 1):
        ws.cell(row=i, column=1, value=line).font = Font(name="Arial", size=10, bold=(i == 1))
    ws.column_dimensions["A"].width = 120

    c = wb.create_sheet("Claims")
    sheet(c, ["ID", "Section", "Claim", "Supporting quote", "Source URL", "Source title", "Evidence", "Status", "Note"],
          [[x.get("id"), x.get("section"), x.get("text"), x.get("quote"), x.get("source_url"), x.get("source_title"), x.get("evidence"), x.get("status"), x.get("note", "")] for x in data.get("claims", [])],
          [8, 14, 60, 34, 38, 22, 16, 11, 30], status_col=7)
    q = wb.create_sheet("Questions")
    sheet(q, ["ID", "Topic", "Question", "Why we are asking", "What the site says", "Priority", "Related claims", "Answer from client"],
          [[x.get("id"), x.get("topic"), x.get("question"), x.get("trigger"), x.get("site_says"), x.get("priority"), ", ".join(x.get("claim_ids", [])), ""] for x in data.get("questions", [])],
          [8, 22, 50, 38, 38, 10, 16, 40])
    s = wb.create_sheet("Sources")
    sheet(s, ["URL", "Title", "Type", "Reviewed"],
          [[x.get("url"), x.get("title"), x.get("type"), x.get("fetched")] for x in data.get("sources", [])], [60, 36, 18, 14])
    wb.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--brand", default=None); ap.add_argument("--version", default=None)
    ap.add_argument("--pages", default=None, help="directory of saved page texts (scripts/save_page.py); required unless --no-verify")
    ap.add_argument("--no-verify", action="store_true", help="skip quote verification (only for pasted-text runs; say so in the chat summary)")
    a = ap.parse_args()
    data = load(a.data)
    version = a.version or data.get("version", "v1")
    brand_path = a.brand or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "brand-config.json")
    brand = load(brand_path)
    brand.update({k: v for k, v in (data.get("brand") or {}).items() if v})
    os.makedirs(a.out, exist_ok=True)
    try:
        idx = claim_index(data)
        if not a.no_verify:
            verify_quotes(data, load_pages(a.pages), strict=True)
        sections = order_sections(validate_sections(data, idx), version)
    except BuildError as e:
        print(f"BUILD ERROR: {e}", file=sys.stderr); sys.exit(2)
    if not sections:
        print("BUILD ERROR: no renderable sections. Include claims and blocks first.", file=sys.stderr); sys.exit(2)
    slug = slugify(data["client"]["name"])
    pdf = os.path.join(a.out, f"{slug}-brand-intelligence-report-{version}.pdf")
    docx = os.path.join(a.out, f"{slug}-meeting-questions-INTERNAL.docx")
    xlsx = os.path.join(a.out, f"{slug}-claims-ledger-INTERNAL.xlsx")
    build_pdf(data, sections, brand, pdf, version)
    nq = build_questions_docx(data, brand, docx)
    build_ledger_xlsx(data, xlsx)
    from collections import Counter
    cnt = Counter(c.get("status") for c in data.get("claims", []))
    print(json.dumps({"pdf": pdf, "questions_docx": docx, "ledger_xlsx": xlsx, "sections": [s["key"] for s in sections],
                      "claims": dict(cnt), "questions": nq, "quotes_verified": not a.no_verify}, indent=2))


if __name__ == "__main__":
    main()
