#!/usr/bin/env python3
"""Client-safety checks on the finished PDF.

Usage: python scripts/qa_check.py --pdf report.pdf --data report-data.json [--allow word1,word2] [--min-pages 3] [--max-pages 16]

Exit code 0 = no failures (warnings are listed). Exit code 1 = at least one failure.
Failures: hedging words, internal labels or claim IDs, metadata leaks.
Warnings: numbers not found in included claims, page count outside the expected range.
"""
import argparse, json, re, sys

HEDGES = [r"likely", r"unlikely", r"probably", r"possibly", r"perhaps", r"might", r"could", r"appears? to", r"seems?", r"seemingly",
          r"suggests? that", r"presumably", r"apparently", r"assum\w*", r"hypothes\w*", r"unverified", r"needs? (to be )?validat\w*",
          r"to be confirmed", r"typically", r"generally", r"often", r"we believe", r"indicates?", r"estimated?", r"around \d", r"approximately", r"roughly", r"\bTBC\b", r"\bTBD\b", r"confidence", r"speculat\w*", r"may"]
# 'may' only counts when lowercase (so the month May is fine); other hedges are case-insensitive.
INTERNAL = [r"\bINTERNAL\b", r"ledger", r"\bC\d{3}\b", r"\bQ\d{2}\b", r"single_external", r"\binferred\b", r"observed_absence",
            r"client_confirmed", r"meeting question", r"question list", r"do not share", r"evidence level"]
NUM_RE = re.compile(r"(?<![A-Za-z\d])\d[\d,]*(?:\.\d+)?(?![A-Za-z])")


def norm(t): return re.sub(r"[,\s]", "", t).rstrip(".")


def pdf_pages(path):
    try:
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            return [(p.extract_text() or "") for p in pdf.pages], dict(pdf.metadata or {})
    except Exception:
        from pypdf import PdfReader
        r = PdfReader(path)
        return [(p.extract_text() or "") for p in r.pages], {k: str(v) for k, v in (r.metadata or {}).items()}


def context(text, m, w=40):
    s = max(0, m.start() - w); e = min(len(text), m.end() + w)
    return text[s:e].replace("\n", " ")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True); ap.add_argument("--data", required=True)
    ap.add_argument("--allow", default=""); ap.add_argument("--min-pages", type=int, default=3); ap.add_argument("--max-pages", type=int, default=16)
    a = ap.parse_args()
    allow = {w.strip().lower() for w in a.allow.split(",") if w.strip()}
    data = json.load(open(a.data, encoding="utf-8"))
    pages, meta = pdf_pages(a.pdf)
    fails, warns = [], []

    for i, text in enumerate(pages, 1):
        body = re.sub(r"\(cid:\d+\)", "", text)
        body = re.sub(r"\bPage \d+\b", "", body)
        body = "\n".join(l for l in body.split("\n") if not re.match(r"^(Brand Intelligence Report|Prepared by .*)$", l.strip()))
        for pat in HEDGES:
            flags = 0 if pat == "may" else re.IGNORECASE
            for m in re.finditer(r"\b" + pat + r"\b" if not pat.startswith(r"\b") else pat, body, flags):
                if m.group(0).lower() in allow: continue
                fails.append(f"p{i}: hedging word '{m.group(0)}' ...{context(body, m)}...")
        for pat in INTERNAL:
            for m in re.finditer(pat, body, re.IGNORECASE if pat not in (r"\bC\d{3}\b", r"\bQ\d{2}\b") else 0):
                fails.append(f"p{i}: internal label '{m.group(0)}' ...{context(body, m)}...")

    blob = " ".join(str(v) for v in meta.values()).lower()
    for w in ("internal", "ledger", "question", "claim", "inferred"):
        if w in blob: fails.append(f"metadata contains '{w}': {meta}")

    allowed = set()
    for c in data.get("claims", []):
        if c.get("status") == "included":
            allowed |= {norm(t) for t in NUM_RE.findall((c.get("text") or "") + " " + (c.get("quote") or ""))}
    extra = json.dumps({"client": data.get("client", {}), "date": data.get("date", ""), "sources": data.get("sources", []), "v": data.get("version", "")})
    allowed |= {norm(t) for t in NUM_RE.findall(extra)}
    allowed |= {norm(t) for t in NUM_RE.findall(" ".join(c.get("source_url", "") + c.get("source_title", "") for c in data.get("claims", [])))}
    n_pages = len(pages)
    for i, text in enumerate(pages, 1):
        body = re.sub(r"\(cid:\d+\)", "", text)
        body = re.sub(r"\bPage \d+\b", "", body)
        for t in set(NUM_RE.findall(body)):
            if norm(t) not in allowed and not (t.isdigit() and int(t) <= max(n_pages, 20)):
                warns.append(f"p{i}: number '{t}' not found in included claims or client details")

    n = len(pages)
    if n < a.min_pages or n > a.max_pages:
        warns.append(f"page count {n} is outside the usual {a.min_pages}-{a.max_pages} range (fine for thin or very full reports, but check)")

    print(json.dumps({"pages": n, "failures": fails, "warnings": warns, "status": "FAIL" if fails else "PASS"}, indent=2))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
