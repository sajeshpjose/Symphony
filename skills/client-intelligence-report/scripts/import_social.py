#!/usr/bin/env python3
"""Turn the social snapshot spreadsheet into per-brand, per-platform facts with engagement computed.

Usage: python scripts/import_social.py --xlsx social-snapshot.xlsx --out social-facts.json
Writes <out>.txt for quote verification (save it with save_page.py under file://social-snapshot.xlsx).
"""
import argparse, json, datetime as dt
import pandas as pd


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--xlsx", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
    df = pd.read_excel(a.xlsx, sheet_name="Snapshot")
    df = df[~df["Notes"].astype(str).str.contains("Example row", na=False)]
    rows, lines = [], ["Social snapshot export social-snapshot.xlsx"]
    for _, r in df.iterrows():
        n = int(r.get("Posts counted") or 0)
        inter = sum(float(r.get(c) or 0) for c in ("Likes (last 10)", "Comments (last 10)", "Shares (last 10)"))
        avg = round(inter / n, 1) if n else None
        fol = float(r.get("Followers") or 0)
        rate = round(avg / fol * 100, 2) if (avg is not None and fol and n >= 10) else None
        snap = pd.to_datetime(r.get("Snapshot date"), errors="coerce"); last = pd.to_datetime(r.get("Last post date"), errors="coerce")
        days = int((snap - last).days) if pd.notna(snap) and pd.notna(last) else None
        row = {"brand": r["Brand"], "platform": r["Platform"], "handle": r.get("Handle"), "followers": int(fol), "posts_last_30_days": int(r.get("Posts last 30 days") or 0),
               "posts_counted": n, "avg_interactions_per_post": avg, "engagement_rate_pct": rate, "days_since_last_post": days,
               "inactive_90_days": (days is not None and days > 90), "views_last_10": int(r.get("Views (last 10)") or 0) or None,
               "formats": str(r.get("Formats") or ""), "bio_link_works": str(r.get("Bio link works") or ""), "snapshot_date": str(snap.date()) if pd.notna(snap) else ""}
        rows.append(row)
        lines.append(f"{row['brand']} {row['platform']}: followers {row['followers']}; posts last 30 days {row['posts_last_30_days']}; average interactions per post {avg}; engagement rate {rate}%; days since last post {days}; formats {row['formats']}; snapshot {row['snapshot_date']}")
    json.dump(rows, open(a.out, "w"), indent=2); open(a.out.rsplit(".", 1)[0] + ".txt", "w").write("\n".join(lines))
    print(json.dumps(rows, indent=2))


if __name__ == "__main__":
    main()
