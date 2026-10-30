#!/usr/bin/env python3
"""Render social creatives: the user's chosen photo, a soft fade, three short text lines and the client logo.

Usage:
  python scripts/render_creative.py --profile client-profile.json --copy copy.json --image photo.jpg --out DIR \
      [--platforms facebook,linkedin,instagram] [--focus 0.5,0.4]
Without --image the creatives render on the brand colour as previews (file names end in -preview).

Design rules, enforced by what this script is able to draw: the photo fills the canvas, text sits directly on it,
and the only things drawn are two soft gradient fades, three lines of text and the logo. No boxes, borders, panels or shapes.
"""
import argparse, json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lint_copy

SIZES = {"facebook": (1200, 630), "linkedin": (1200, 627), "instagram": (1080, 1350)}
FONT_DIRS = ["/usr/share/fonts/truetype/google-fonts", "/usr/share/fonts/truetype/liberation", "/usr/share/fonts/truetype/dejavu"]
FALLBACK = (24, 24, 24)


def find_font(names, override=None, base=None):
    if override:
        p = override if os.path.isabs(override) else os.path.join(base or ".", override)
        if os.path.exists(p): return p
    for n in names:
        for d in FONT_DIRS:
            p = os.path.join(d, n)
            if os.path.exists(p): return p
    raise SystemExit("No usable font found. Install Poppins or DejaVu, or set brand.heading_font and brand.body_font in the profile.")


def hex_rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(c):
    def f(v):
        v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def contrast(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def wrap(text, font, max_w):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if font.getlength(t) <= max_w or not cur: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


def balanced(text, font, max_w):
    """Wrap into the fewest lines, then narrow the width until the line count would grow, so lines come out even."""
    lines = wrap(text, font, max_w)
    if len(lines) < 2: return lines
    n, lo, hi = len(lines), max(font.getlength(w) for w in text.split()), max_w
    while hi - lo > 2:
        mid = (lo + hi) / 2
        if len(wrap(text, font, mid)) == n: hi = mid
        else: lo = mid
    return wrap(text, font, hi)


def fit(text, font_path, start, max_w, max_lines, min_size, even=False):
    size = start
    while size >= min_size:
        f = ImageFont.truetype(font_path, int(size)); lines = wrap(text, f, max_w)
        if len(lines) <= max_lines and all(f.getlength(l) <= max_w for l in lines):
            if even: lines = balanced(text, f, max_w)
            return f, lines, int(size)
        size *= 0.95
    raise SystemExit(f"Text does not fit at a readable size: '{text}'. Shorten it.")


def cover(img, W, H, fx, fy):
    iw, ih = img.size; s = max(W / iw, H / ih)
    img = img.resize((max(W, round(iw * s)), max(H, round(ih * s))), Image.LANCZOS)
    x = min(max(round(fx * img.width - W / 2), 0), img.width - W); y = min(max(round(fy * img.height - H / 2), 0), img.height - H)
    return img.crop((x, y, x + W, y + H))


def fade(img, height, max_alpha, from_bottom=True, color=(8, 8, 8)):
    W, H = img.size
    g = Image.linear_gradient("L").resize((W, height))
    if not from_bottom: g = ImageOps.flip(g)
    g = g.point(lambda v: int(255 * ((v / 255) ** 1.7) * max_alpha))
    layer = Image.new("RGB", (W, height), color)
    img.paste(layer, (0, H - height if from_bottom else 0), g)
    return img


def load_logo(path):
    if path.lower().endswith(".svg"):
        tmp = os.path.join(tempfile.mkdtemp(), "logo.png")
        for cmd in (["rsvg-convert", "-w", "1200", path, "-o", tmp], ["convert", "-background", "none", "-density", "300", path, tmp]):
            try:
                subprocess.run(cmd, check=True, capture_output=True)
                if os.path.exists(tmp): path = tmp; break
            except Exception:
                continue
        else:
            raise SystemExit("Cannot read the SVG logo here. Provide a PNG with a transparent background, 600 pixels wide or more.")
    return Image.open(path).convert("RGBA")


def tracked(draw, xy, text, font, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill); x += font.getlength(ch) + tracking


def render(platform, copy, prof, base, image, out_dir, focus):
    W, H = SIZES[platform]; br = prof.get("brand", {}); warns = []
    land = platform != "instagram"
    m = round(W * (0.07 if land else 0.085)); bottom = m if land else round(m * 1.35)
    primary = hex_rgb(br.get("primary", "#222222")); accent = hex_rgb(br.get("accent", "#FFFFFF"))
    hfont = find_font(["Poppins-Medium.ttf", "DejaVuSans-Bold.ttf"], br.get("heading_font"), base)
    bfont = find_font(["Poppins-Regular.ttf", "LiberationSans-Regular.ttf", "DejaVuSans.ttf"], br.get("body_font"), base)
    tw = round(W * (0.72 if land else 0.83))
    heading_font, hl, hs = fit(copy["heading"].strip(), hfont, 62 if land else 88, tw, 2 if land else 3, 36 if land else 52, even=True)
    desc_font, dl, ds = fit(copy["description"].strip(), bfont, 26 if land else 33, tw, 2 if land else 3, 20 if land else 26)
    es = max(round(hs * 0.34) if land else round(hs * 0.30), 17)
    eyebrow_font = ImageFont.truetype(find_font(["Poppins-Medium.ttf", "DejaVuSans-Bold.ttf"], br.get("heading_font"), base), es)
    eyebrow = copy["eyebrow"].strip().upper()
    hlh, dlh = round(hs * 1.13), round(ds * 1.42); g1, g2 = round(hs * 0.30), round(hs * 0.26)
    total = es + g1 + hlh * len(hl) + g2 + dlh * len(dl)
    top = H - bottom - total
    if image:
        base_im = cover(image.convert("RGB"), W, H, *focus)
        if image.width < W * 1.3: warns.append(f"{platform}: image is only {image.width}px wide; use 2400px or more for a sharp result")
        for alpha in (0.78, 0.84, 0.90, 0.95):
            im = base_im.copy(); im = fade(im, round(H * (0.74 if land else 0.66)), alpha, True); im = fade(im, round(H * 0.30), 0.45, False)
            region = im.crop((m, top, m + tw, top + total)).resize((1, 1), Image.BOX).getpixel((0, 0))
            if contrast((255, 255, 255), region) >= 7.0: break
        else:
            warns.append(f"{platform}: the photo is bright where the text sits; choose an image with a calmer, darker lower left")
        bg = region
    else:
        im = Image.new("RGB", (W, H), primary); bg = primary
        if contrast((255, 255, 255), primary) < 4.5: warns.append("brand primary colour is too light for white text; choose the photo before final export")
    d = ImageDraw.Draw(im)
    ecol = accent if contrast(accent, bg) >= 4.5 else (255, 255, 255)
    if ecol != accent: warns.append(f"{platform}: accent colour is low contrast on this photo, eyebrow set in white")
    y = top
    tracked(d, (m, y), eyebrow, eyebrow_font, ecol, es * 0.16); y += es + g1
    for l in hl: d.text((m, y), l, font=heading_font, fill=(255, 255, 255)); y += hlh
    y += g2
    for l in dl: d.text((m, y), l, font=desc_font, fill=(236, 236, 236)); y += dlh
    logo_path = br.get("logo_path", "")
    if logo_path:
        lp = logo_path if os.path.isabs(logo_path) else os.path.join(base, logo_path)
        if os.path.exists(lp):
            lg = load_logo(lp)
            if br.get("logo_mode", "original") == "white":
                a = lg.split()[3]; lg = Image.new("RGBA", lg.size, (255, 255, 255, 255)); lg.putalpha(a)
            bw, bh = round(W * (0.20 if land else 0.26)), round(H * (0.14 if land else 0.08))
            s = min(bw / lg.width, bh / lg.height); lg = lg.resize((max(1, round(lg.width * s)), max(1, round(lg.height * s))), Image.LANCZOS)
            pos = br.get("logo_position", "top-left")
            x = m if "left" in pos else W - m - lg.width; yy = m if "top" in pos else H - m - lg.height
            im.paste(lg, (x, yy), lg)
        else:
            warns.append(f"logo file not found: {lp}")
    else:
        warns.append("no logo on file for this client; rendered without it")
    name = f"{platform}{'' if image else '-preview'}.png"
    os.makedirs(out_dir, exist_ok=True); im.save(os.path.join(out_dir, name), "PNG", optimize=True)
    return name, warns, {"heading_size": hs, "heading_lines": len(hl), "description_lines": len(dl)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", required=True); ap.add_argument("--copy", required=True); ap.add_argument("--image"); ap.add_argument("--out", required=True)
    ap.add_argument("--platforms", default="facebook,linkedin,instagram"); ap.add_argument("--focus", default="0.5,0.45")
    a = ap.parse_args()
    prof = json.load(open(a.profile, encoding="utf-8")); copy = json.load(open(a.copy, encoding="utf-8"))
    fails, warns, _ = lint_copy.check_creative(copy, lint_copy.load_banned(prof.get("banned_words")))
    if fails:
        print(json.dumps({"status": "FAIL", "failures": fails}, indent=2)); sys.exit(2)
    fx, fy = [float(x) for x in a.focus.split(",")]
    image = Image.open(a.image) if a.image else None
    base = os.path.dirname(os.path.abspath(a.profile)); results = []
    for p in [x.strip() for x in a.platforms.split(",") if x.strip()]:
        name, w, info = render(p, copy, prof, base, image, a.out, (fx, fy)); warns += w; results.append({"file": name, **info})
    print(json.dumps({"status": "OK", "image_used": bool(image), "files": results, "warnings": sorted(set(warns))}, indent=2))


if __name__ == "__main__":
    main()
