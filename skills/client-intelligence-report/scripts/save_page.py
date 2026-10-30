#!/usr/bin/env python3
"""Save the text of a fetched page so claims can be verified against it later.

Usage:
  python scripts/save_page.py --dir work/<client>/pages --url https://site/about --file about.txt
  cat about.txt | python scripts/save_page.py --dir work/<client>/pages --url https://site/about
  python scripts/save_page.py --dir work/<client>/pages --list      # show saved pages

Each page is stored as <sha1 of url>.txt with the URL on the first line and the text after it.
Save every page you read, including competitor pages and review pages, before writing claims.
"""
import argparse, hashlib, os, sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True); ap.add_argument("--url"); ap.add_argument("--file"); ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    os.makedirs(a.dir, exist_ok=True)
    if a.list:
        for f in sorted(os.listdir(a.dir)):
            with open(os.path.join(a.dir, f), encoding="utf-8") as fh:
                url = fh.readline().strip(); n = len(fh.read().split())
            print(f"{url}  ({n} words)")
        return
    if not a.url:
        sys.exit("--url is required")
    text = open(a.file, encoding="utf-8").read() if a.file else sys.stdin.read()
    if len(text.split()) < 20:
        print("WARNING: fewer than 20 words saved; the page may not have rendered. Do not base claims on it.", file=sys.stderr)
    path = os.path.join(a.dir, hashlib.sha1(a.url.strip().encode()).hexdigest()[:16] + ".txt")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(a.url.strip() + "\n" + text)
    print(path)


if __name__ == "__main__":
    main()
