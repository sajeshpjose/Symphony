#!/usr/bin/env python3
"""Parse a LinkedIn personal-profile or company-page analytics export (AggregateAnalytics_*.xlsx) into facts.

Usage: python scripts/import_linkedin_profile.py --xlsx AggregateAnalytics_Name_2025-10-30_2026-10-29.xlsx --out li-facts.json
Writes <out>.txt for quote verification; save it with save_page.py under file://<file name>.
Sheets expected: DISCOVERY, ENGAGEMENT, TOP POSTS, FOLLOWERS, AUDIENCE DEMOGRAPHICS (CONTENT DEMOGRAPHICS optional).
"""
import argparse, json, os, re, warnings
import pandas as pd
warnings.filterwarnings("ignore")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--xlsx", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
    x = pd.ExcelFile(a.xlsx); f = {"source_file": os.path.basename(a.xlsx)}
    disc = pd.read_excel(x, "DISCOVERY", header=None)
    f["period"] = str(disc.iloc[0, 1]); kv = {str(r[0]).strip(): r[1] for r in disc.iloc[1:].values}
    f["impressions"] = int(kv.get("Impressions", 0)); f["members_reached"] = int(kv.get("Members reached", 0))
    eng = pd.read_excel(x, "ENGAGEMENT"); eng["Date"] = pd.to_datetime(eng["Date"])
    f["engagements"] = int(eng["Engagements"].sum())
    monthly = eng.set_index("Date").resample("ME").sum()
    f["impressions_by_month"] = {d.strftime("%Y-%m"): int(v) for d, v in monthly["Impressions"].items()}
    top_m = monthly["Impressions"].idxmax(); f["peak_month"] = top_m.strftime("%B %Y"); f["peak_month_impressions"] = int(monthly["Impressions"].max())
    f["peak_month_share_pct"] = round(f["peak_month_impressions"] / f["impressions"] * 100, 1) if f["impressions"] else None
    fo = pd.read_excel(x, "FOLLOWERS", header=None)
    f["followers_total"] = int(fo.iloc[0, 1]); f["followers_total_label"] = str(fo.iloc[0, 0])
    fo2 = pd.read_excel(x, "FOLLOWERS", header=2); fo2["Date"] = pd.to_datetime(fo2["Date"])
    f["new_followers"] = int(fo2["New followers"].sum())
    f["new_followers_by_month"] = {d.strftime("%Y-%m"): int(v) for d, v in fo2.set_index("Date").resample("ME")["New followers"].sum().items()}
    tp = pd.read_excel(x, "TOP POSTS", header=2)
    a_ = tp[["Post URL", "Post Publish Date", "Engagements"]].dropna(); a_["Post Publish Date"] = pd.to_datetime(a_["Post Publish Date"])
    f["posts_listed"] = len(a_); f["posts_by_month"] = {d.strftime("%Y-%m"): int(v) for d, v in a_.set_index("Post Publish Date").resample("ME")["Engagements"].count().items()}
    f["median_engagements_per_post"] = float(a_["Engagements"].median()) if len(a_) else None
    b_ = tp[["Post URL.1", "Post Publish Date.1", "Impressions"]].dropna().sort_values("Impressions", ascending=False)
    f["top_post_impressions"] = int(b_["Impressions"].iloc[0]) if len(b_) else None
    f["top_post_engagements"] = int(a_["Engagements"].max()) if len(a_) else None
    f["post_topics"] = [re.sub(r".*_", "", u).split("-share")[0].split("-ugcPost")[0] for u in a_["Post URL"].head(25)]
    ad = pd.read_excel(x, "AUDIENCE DEMOGRAPHICS")
    demo = {}
    for cat, g in ad.groupby(ad.columns[0]):
        demo[cat] = [(str(v), str(p)) for v, p in zip(g.iloc[:, 1], g.iloc[:, 2])]
    f["audience"] = demo
    lines = [f"LinkedIn analytics export {f['source_file']} period {f['period']}", f"impressions {f['impressions']} members reached {f['members_reached']} engagements {f['engagements']}",
             f"followers total {f['followers_total']} new followers {f['new_followers']}", f"posts listed {f['posts_listed']} median engagements per post {f['median_engagements_per_post']} top post impressions {f['top_post_impressions']} top post engagements {f['top_post_engagements']}",
             f"peak month {f['peak_month']} impressions {f['peak_month_impressions']} share {f['peak_month_share_pct']}%",
             "impressions by month: " + "; ".join(f"{k} {v}" for k, v in f["impressions_by_month"].items()),
             "new followers by month: " + "; ".join(f"{k} {v}" for k, v in f["new_followers_by_month"].items()),
             "posts by month: " + "; ".join(f"{k} {v}" for k, v in f["posts_by_month"].items()),
             "post topics: " + "; ".join(f["post_topics"])]
    for cat, items in demo.items(): lines.append(f"{cat}: " + "; ".join(f"{v} {p}" for v, p in items))
    json.dump(f, open(a.out, "w"), indent=2, default=str); open(a.out.rsplit(".", 1)[0] + ".txt", "w").write("\n".join(lines))
    print("\n".join(lines[:5]))


if __name__ == "__main__":
    main()
