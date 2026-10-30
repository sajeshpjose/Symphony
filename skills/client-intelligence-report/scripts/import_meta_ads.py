#!/usr/bin/env python3
"""Parse a Meta Ads Manager export (xlsx with 'Raw Data Report' sheet, or the CSV equivalent) into facts.

Usage: python scripts/import_meta_ads.py --file report.xlsx --out meta-facts.json
Writes <out>.txt for quote verification; save it with save_page.py under file://<file name>.
"""
import argparse, json, os, warnings
import pandas as pd
warnings.filterwarnings("ignore")


def load(path):
    if path.lower().endswith((".xlsx", ".xls")):
        x = pd.ExcelFile(path); sheet = "Raw Data Report" if "Raw Data Report" in x.sheet_names else x.sheet_names[0]
        raw = pd.read_excel(x, sheet, header=None)
    else:
        raw = pd.read_csv(path, header=None)
    hdr = next(i for i in range(len(raw)) if "Campaign name" in raw.iloc[i].astype(str).tolist())
    df = raw.iloc[hdr + 1:].copy(); df.columns = [str(c) for c in raw.iloc[hdr].tolist()]
    df = df.loc[:, [c for c in df.columns if c != "nan"]].dropna(how="all")
    return df


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--file", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
    df = load(a.file)
    for c in ("Reach", "Impressions", "Frequency", "Results", "Amount spent (CAD)", "Amount spent (USD)", "Cost per result"):
        if c in df.columns: df[c] = pd.to_numeric(df[c], errors="coerce")
    spend_col = next((c for c in df.columns if c.startswith("Amount spent")), None); cur = spend_col.split("(")[-1].rstrip(")") if spend_col and "(" in spend_col else ""
    camps = df[df["Delivery level"].astype(str).str.lower() == "campaign"]; sets = df[df["Delivery level"].astype(str).str.lower() == "adset"]
    period = f"{str(df['Reporting starts'].iloc[0])[:10]} to {str(df['Reporting ends'].iloc[0])[:10]}" if "Reporting starts" in df.columns else ""
    f = {"source_file": os.path.basename(a.file), "currency": cur, "period": period, "campaigns": [], "ad_sets": []}
    for _, r in camps.iterrows():
        f["campaigns"].append({"name": r["Campaign name"], "status": r.get("Delivery status"), "reach": int(r["Reach"] or 0), "impressions": int(r["Impressions"] or 0), "frequency": round(float(r["Frequency"] or 0), 2),
                               "result_type": r.get("Result type"), "results": int(r["Results"]) if pd.notna(r.get("Results")) else 0, "spend": round(float(r[spend_col] or 0), 2), "cost_per_result": round(float(r["Cost per result"]), 2) if pd.notna(r.get("Cost per result")) else None})
    for _, r in sets.iterrows():
        f["ad_sets"].append({"campaign": r["Campaign name"], "name": r["Ad set name"], "reach": int(r["Reach"] or 0), "impressions": int(r["Impressions"] or 0), "frequency": round(float(r["Frequency"] or 0), 2),
                             "results": int(r["Results"]) if pd.notna(r.get("Results")) else 0, "spend": round(float(r[spend_col] or 0), 2), "cost_per_result": round(float(r["Cost per result"]), 2) if pd.notna(r.get("Cost per result")) else None,
                             "starts": str(r.get("Starts"))[:10], "ends": str(r.get("Ends"))[:10]})
    f["total_spend"] = round(sum(c["spend"] for c in f["campaigns"]), 2); f["total_results"] = sum(c["results"] for c in f["campaigns"])
    lines = [f"Meta Ads export {f['source_file']} period {period} currency {cur}", f"total spend {f['total_spend']} total results {f['total_results']}"]
    for c in f["campaigns"]: lines.append(f"campaign {c['name']}: status {c['status']}; reach {c['reach']}; impressions {c['impressions']}; frequency {c['frequency']}; result type {c['result_type']}; results {c['results']}; spend {c['spend']}; cost per result {c['cost_per_result']}")
    for s in f["ad_sets"]: lines.append(f"ad set {s['name']}: reach {s['reach']}; impressions {s['impressions']}; frequency {s['frequency']}; results {s['results']}; spend {s['spend']}; cost per result {s['cost_per_result']}; starts {s['starts']}; ends {s['ends']}")
    json.dump(f, open(a.out, "w"), indent=2, default=str); open(a.out.rsplit(".", 1)[0] + ".txt", "w").write("\n".join(lines)); print("\n".join(lines))


if __name__ == "__main__":
    main()
