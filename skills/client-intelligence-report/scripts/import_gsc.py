#!/usr/bin/env python3
"""Parse Search Console Performance exports (Queries.csv, Pages.csv) into claim-ready facts.

Usage: python scripts/import_gsc.py --queries Queries.csv [--pages Pages.csv] --brand danburite --out gsc-facts.json
Writes <out>.txt for quote verification (save it with save_page.py under file://<file name>).
"""
import argparse, json, os
import pandas as pd


def num(s):
    return pd.to_numeric(s.astype(str).str.replace("%", "").str.replace(",", ""), errors="coerce").fillna(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--queries", required=True); ap.add_argument("--pages"); ap.add_argument("--brand", default=""); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    q = pd.read_csv(a.queries); q.columns = [c.strip().lower() for c in q.columns]
    qcol = [c for c in q.columns if "quer" in c][0]
    for c in ("clicks", "impressions", "ctr", "position"):
        if c in q.columns: q[c] = num(q[c])
    tot_c, tot_i = int(q["clicks"].sum()), int(q["impressions"].sum())
    brand = a.brand.lower()
    mask = q[qcol].astype(str).str.lower().str.contains(brand) if brand else pd.Series(False, index=q.index)
    f = {"source_files": [os.path.basename(a.queries)] + ([os.path.basename(a.pages)] if a.pages else []),
         "queries": len(q), "clicks_total": tot_c, "impressions_total": tot_i,
         "branded_clicks": int(q.loc[mask, "clicks"].sum()), "branded_share_pct": round(q.loc[mask, "clicks"].sum() / tot_c * 100, 1) if tot_c else None,
         "top_nonbrand_queries": q.loc[~mask].sort_values("clicks", ascending=False).head(20)[[qcol, "clicks", "impressions"] + (["position"] if "position" in q.columns else [])].values.tolist()}
    if "position" in q.columns:
        near = q.loc[(~mask) & (q["position"].between(4, 15)) & (q["impressions"] >= q["impressions"].quantile(0.8))].sort_values("impressions", ascending=False).head(15)
        f["page_one_or_two_opportunities"] = near[[qcol, "impressions", "clicks", "position"]].values.tolist()
    lines = [f"Search Console export {', '.join(f['source_files'])}.", f"queries {f['queries']} clicks total {tot_c} impressions total {tot_i} branded clicks {f['branded_clicks']} branded share pct {f['branded_share_pct']}",
             "top nonbrand queries: " + "; ".join(" ".join(str(x) for x in r) for r in f["top_nonbrand_queries"])]
    if a.pages:
        p = pd.read_csv(a.pages); p.columns = [c.strip().lower() for c in p.columns]
        pcol = [c for c in p.columns if "page" in c][0]
        for c in ("clicks", "impressions"): p[c] = num(p[c])
        blog = p[pcol].astype(str).str.contains("/blog")
        f["pages"] = len(p); f["blog_share_of_clicks_pct"] = round(p.loc[blog, "clicks"].sum() / p["clicks"].sum() * 100, 1) if p["clicks"].sum() else None
        f["top_pages"] = p.sort_values("clicks", ascending=False).head(15)[[pcol, "clicks", "impressions"]].values.tolist()
        lines.append(f"pages {f['pages']} blog share of clicks pct {f['blog_share_of_clicks_pct']}")
        lines.append("top pages: " + "; ".join(" ".join(str(x) for x in r) for r in f["top_pages"]))
    if "page_one_or_two_opportunities" in f:
        lines.append("page one or two opportunities: " + "; ".join(" ".join(str(x) for x in r) for r in f["page_one_or_two_opportunities"]))
    json.dump(f, open(a.out, "w"), indent=2, default=str)
    open(a.out.rsplit(".", 1)[0] + ".txt", "w").write("\n".join(lines))
    print(json.dumps({k: v for k, v in f.items() if not isinstance(v, list)}, indent=2))


if __name__ == "__main__":
    main()
