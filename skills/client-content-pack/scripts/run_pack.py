#!/usr/bin/env python3
"""Check and build everything for one topic folder in one command.

Usage: python scripts/run_pack.py --profile client-profile.json --dir TOPIC_DIR [--image photo.jpg] [--focus 0.5,0.45] [--no-blog]
TOPIC_DIR holds blog.md, posts.json, copy.json and image-keywords.txt (written by the skill).
Steps: lint copy, lint posts, lint blog, build blog HTML and schema, render creatives into TOPIC_DIR/creatives.
Exit code 1 if any lint failure, so nothing half-checked gets delivered.
"""
import argparse, glob, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lint_copy


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", required=True); ap.add_argument("--dir", required=True); ap.add_argument("--image"); ap.add_argument("--focus", default="0.5,0.45"); ap.add_argument("--no-blog", action="store_true")
    a = ap.parse_args(); d = a.dir; report = {"dir": d, "lint": {}, "built": [], "warnings": []}; failed = False
    checks = [("creative", "copy.json"), ("posts", "posts.json")] + ([] if a.no_blog else [("blog", "blog.md")])
    for kind, fn in checks:
        path = os.path.join(d, fn)
        if not os.path.exists(path): report["lint"][fn] = "MISSING"; failed = True; continue
        fails, warns, stats = lint_copy.run(kind, path, a.profile)
        report["lint"][fn] = {"status": "FAIL" if fails else "PASS", "failures": fails, "warnings": warns, "stats": stats}; failed |= bool(fails)
    if not os.path.exists(os.path.join(d, "image-keywords.txt")): report["warnings"].append("image-keywords.txt is missing"); 
    if failed:
        print(json.dumps(report, indent=2, ensure_ascii=False)); sys.exit(1)
    if not a.no_blog:
        r = subprocess.run([sys.executable, os.path.join(HERE, "build_blog.py"), "--md", os.path.join(d, "blog.md"), "--profile", a.profile, "--out", d], capture_output=True, text=True)
        if r.returncode: report["lint"]["build_blog"] = r.stderr.strip(); failed = True
        else: report["built"] += ["blog.html", "blog.schema.json"]
    image = a.image or next(iter(sorted(glob.glob(os.path.join(d, "image.*")))), None)
    cmd = [sys.executable, os.path.join(HERE, "render_creative.py"), "--profile", a.profile, "--copy", os.path.join(d, "copy.json"), "--out", os.path.join(d, "creatives"), "--focus", a.focus]
    if image: cmd += ["--image", image]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: report["lint"]["render"] = (r.stdout or r.stderr).strip(); failed = True
    else:
        out = json.loads(r.stdout); report["built"] += [("creatives/" + f["file"]) for f in out["files"]]; report["warnings"] += out["warnings"]; report["image_used"] = out["image_used"]
    print(json.dumps(report, indent=2, ensure_ascii=False)); sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
