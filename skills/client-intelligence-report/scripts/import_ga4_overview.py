#!/usr/bin/env python3
"""Parse a GA4 overview CSV export (e.g. "Generate leads overview") into claim-ready facts.

Usage: python scripts/import_ga4_overview.py --csv Generate_leads_overview.csv --out ga4-facts.json [--brand danburite]

Also writes a plain-text copy of the parsed blocks (<out>.txt) that you should save with save_page.py
under the URL file://<csv file name> so quote verification can run.
"""
import argparse, json, re, os


def parse_blocks(raw):
    raw = raw.replace("\r", "")
    meta = {"account": "", "property": "", "start": "", "end": ""}
    secs, cur = [], None
    for line in raw.split("\n"):
        if line.startswith("#"):
            m = re.match(r"#\s*(Account|Property|Start date|End date):\s*(.*)", line)
            if m:
                k = m.group(1).lower().replace(" date", ""); meta[k] = meta[k] or m.group(2).strip()
            continue
        if not line.strip():
            cur = None; continue
        if cur is None:
            cur = {"header": line, "rows": []}; secs.append(cur)
        else:
            cur["rows"].append(line)
    return meta, secs


def pairs(sec):
    out = []
    for r in sec["rows"]:
        a, _, b = r.rpartition(",")
        try: out.append((a, float(b)))
        except ValueError: pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True); ap.add_argument("--out", required=True); ap.add_argument("--brand", default="")
    a = ap.parse_args()
    meta, secs = parse_blocks(open(a.csv, encoding="utf-8-sig").read())
    f = {"source_file": os.path.basename(a.csv), "property": meta["property"], "start": meta["start"], "end": meta["end"], "blocks": [s["header"] for s in secs]}
    lines = [f"GA4 export {f['source_file']} for property {meta['property']}, start date {meta['start']}, end date {meta['end']}."]
    for s in secs:
        h = s["header"]
        if h.startswith("Nth week,New users"):
            p = pairs(s); f["new_users"] = int(sum(v for _, v in p)); f["new_users_by_week"] = [(int(k), int(v)) for k, v in p]
        elif h.startswith("Nth week,Returning users"):
            p = pairs(s); f["returning_users"] = int(sum(v for _, v in p)); f["returning_users_by_week"] = [(int(k), int(v)) for k, v in p]
        elif h.startswith("Date,Week"):
            f["retention_cohorts"] = [(r.split(",")[0], [int(x) for x in r.split(",")[1:]]) for r in s["rows"]]
        elif "Qualified leads" in h:
            f["qualified_leads"] = int(sum(v for _, v in pairs(s)))
        elif "Converted leads" in h:
            f["converted_leads"] = int(sum(v for _, v in pairs(s)))
        elif h.startswith("Platform,Key events"):
            f["key_events_rows"] = len(pairs(s))
        elif h.startswith("First user primary channel group"):
            f["new_users_by_channel"] = {k: int(v) for k, v in pairs(s)}
        elif h.startswith("Audience name"):
            f["active_users"] = int(max([v for k, v in pairs(s)] + [0]))
        elif h.startswith("City,"):
            f["cities"] = len(pairs(s)); f["city_users"] = {k: int(v) for k, v in pairs(s)}
        elif h.startswith("Landing page"):
            p = pairs(s); tot = sum(v for _, v in p)
            blog = sum(v for k, v in p if k.startswith("/blog"))
            f["landing_pages"] = len(p); f["impressions_total"] = int(tot)
            f["impressions_blog_share_pct"] = round(blog / tot * 100, 1) if tot else None
            f["top_landing_pages"] = [(k, int(v)) for k, v in p[:15]]
            f["top_service_pages"] = [(k, int(v)) for k, v in p if not k.startswith("/blog")][:12]
        elif h.startswith("Organic Google Search query"):
            p = pairs(s); tot = sum(v for _, v in p)
            brand = a.brand.lower()
            br = sum(v for k, v in p if brand and brand in k.lower())
            f["queries"] = len(p); f["clicks_total"] = int(tot)
            f["branded_clicks"] = int(br); f["branded_share_pct"] = round(br / tot * 100, 1) if tot else None
            f["top_queries"] = [(k, int(v)) for k, v in p[:25]]
            f["top_nonbrand_queries"] = [(k, int(v)) for k, v in p if not (brand and brand in k.lower())][:15]
        elif h.startswith("Session manual source"):
            f["sessions_by_source"] = {k: int(v) for k, v in pairs(s)}
    # week labels from the start date (GA4 Nth week 0001 begins on the start date)
    if f.get("new_users_by_week") and meta["start"]:
        import datetime as dt
        sd = dt.datetime.strptime(meta["start"], "%Y%m%d").date()
        f["week_labels"] = [(sd + dt.timedelta(days=7 * (n - 1))).strftime("%d %b") for n, _ in f["new_users_by_week"]]
        pk = max(f["new_users_by_week"], key=lambda x: x[1]); f["peak_week_new_users"] = pk[1]; f["peak_week_label"] = f["week_labels"][pk[0] - 1]
        f["min_week_new_users"] = min(v for _, v in f["new_users_by_week"])
    if f.get("retention_cohorts"):
        wk1 = [(c, w[1]) for c, w in f["retention_cohorts"] if len(w) > 1 and w[1] >= 0]
        f["week1_returning_total"] = sum(v for _, v in wk1); f["week0_total_for_week1"] = sum(w[0] for c, w in f["retention_cohorts"] if len(w) > 1 and w[1] >= 0)
    if f.get("clicks_total") and f.get("active_users") is not None:
        f["tracking_warning"] = f["clicks_total"] > 3 * max(f["active_users"], 1)
    # text copy for quote verification
    if f.get("new_users_by_week"):
        lines.append("new users by week: " + "; ".join(f"{f['week_labels'][i]} {v}" for i, (_, v) in enumerate(f["new_users_by_week"])))
        lines.append("returning users by week: " + "; ".join(f"{f['week_labels'][i]} {v}" for i, (_, v) in enumerate(f.get("returning_users_by_week", []))))
    if f.get("retention_cohorts"):
        lines.append("retention cohorts (week 0, week 1, week 2...): " + "; ".join(f"{c}: " + ", ".join(str(x) for x in w) for c, w in f["retention_cohorts"]))
    for k, v in f.items():
        if k in ("top_landing_pages", "top_service_pages", "top_queries", "top_nonbrand_queries", "new_users_by_week", "returning_users_by_week", "retention_cohorts", "week_labels"):
            if k in ("new_users_by_week", "returning_users_by_week", "retention_cohorts", "week_labels"): continue
            lines.append(k.replace("_", " ") + ": " + "; ".join(f"{p} {n}" for p, n in v))
        elif isinstance(v, dict):
            lines.append(k.replace("_", " ") + ": " + "; ".join(f"{p} {n}" for p, n in v.items()))
        elif k not in ("blocks",):
            lines.append(f"{k.replace('_', ' ')} {v}")
    json.dump(f, open(a.out, "w"), indent=2)
    open(a.out.rsplit(".", 1)[0] + ".txt", "w").write("\n".join(lines))
    print(json.dumps({k: v for k, v in f.items() if k not in ("top_landing_pages", "top_service_pages", "top_queries", "top_nonbrand_queries", "city_users")}, indent=2))
    print(f"text copy: {a.out.rsplit('.', 1)[0]}.txt  -> save it: python scripts/save_page.py --dir <pages> --url file://{f['source_file']} --file <that txt>")


if __name__ == "__main__":
    main()
