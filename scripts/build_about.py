#!/usr/bin/env python3
"""Builds assets/about.svg ("01 / About me") with the portrait beside the four focus areas.

    python3 scripts/build_about.py [--portrait assets/pic.png]

The portrait is cropped, resized and embedded as a base64 JPEG: GitHub serves README SVGs
through <img>, which does not load external images, so the picture has to live inside the SVG.
Requires Pillow.
"""

import argparse
import base64
import io
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

# Content preserved verbatim from the original About me card.
ITEMS = [
    ("Full-Stack Development", "Building frontend experiences and backend services for real products."),
    ("Shopify Applications", "Exploring embedded apps, storefront experiences, and platform integrations."),
    ("Infrastructure & Delivery", "Working with Linux, containers, deployment, and production environments."),
    ("AI-Powered Products", "Integrating AI capabilities and external APIs into useful application workflows."),
]

W = 900
PX, PY, PW = 40, 80, 262  # portrait frame
CARD_X = PX + PW + 20
CARD_W = W - 40 - CARD_X
CARD_H, CARD_GAP = 92, 11
PH = 4 * CARD_H + 3 * CARD_GAP
H = PY + PH + 40

SANS = "Inter,'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif"
MONO = "'JetBrains Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace"

LINUX = """<symbol id="lg-linux" viewBox="0 0 48 58">
      <ellipse cx="24" cy="34" rx="16" ry="20" fill="#2f343c" stroke="#9aa6b2" stroke-opacity=".55" stroke-width="1.2"/>
      <ellipse cx="24" cy="15" rx="11" ry="11.5" fill="#2f343c" stroke="#9aa6b2" stroke-opacity=".55" stroke-width="1.2"/>
      <ellipse cx="24" cy="37" rx="10.5" ry="15" fill="#f2f2f2"/>
      <ellipse cx="20" cy="13" rx="2.7" ry="3.5" fill="#fff"/><ellipse cx="28" cy="13" rx="2.7" ry="3.5" fill="#fff"/>
      <circle cx="20.7" cy="13.8" r="1.3" fill="#111"/><circle cx="27.3" cy="13.8" r="1.3" fill="#111"/>
      <ellipse cx="24" cy="19.5" rx="5.2" ry="2.7" fill="#F5B000"/>
      <ellipse cx="14" cy="53.5" rx="8.5" ry="3.6" fill="#F5B000"/><ellipse cx="34" cy="53.5" rx="8.5" ry="3.6" fill="#F5B000"/>
    </symbol>"""
NGINX = '<symbol id="lg-nginx" viewBox="0 0 24 24"><path fill="#009639" d="M12 0L1.605 6v12L12 24l10.395-6V6L12 0zm6 16.59c0 .705-.646 1.29-1.529 1.29-.631 0-1.351-.255-1.801-.81l-6-7.141v6.66c0 .721-.57 1.29-1.274 1.29H7.32c-.721 0-1.29-.6-1.29-1.29V7.41c0-.705.63-1.29 1.5-1.29.646 0 1.38.255 1.83.81l5.97 7.141V7.41c0-.721.6-1.29 1.29-1.29h.075c.72 0 1.29.6 1.29 1.29v9.18H18z"/></symbol>'


def sans_width(text, size):
    em = 0.0
    for ch in text:
        if ch in "ijlI|.,:;!'`":
            em += 0.26
        elif ch in "frt()[]{}-/ \"":
            em += 0.36
        elif ch in "mwMW@%":
            em += 0.86
        elif ch.isupper():
            em += 0.66
        else:
            em += 0.53
    return em * size


def wrap(text, size, width):
    lines, line = [], ""
    for word in text.split():
        nxt = f"{line} {word}".strip()
        if line and sans_width(nxt, size) > width:
            lines.append(line)
            line = word
        else:
            line = nxt
    return lines + ([line] if line else [])


def balanced(text, size, width):
    """Two evenly filled lines instead of a long line plus a one-word orphan."""
    lines = wrap(text, size, width)
    if len(lines) == 1:
        return lines
    words = text.split()
    best = min(range(1, len(words)), key=lambda k: max(sans_width(" ".join(words[:k]), size), sans_width(" ".join(words[k:]), size)))
    out = [" ".join(words[:best]), " ".join(words[best:])]
    assert all(sans_width(l, size) <= width for l in out), f"'{text}' does not fit in two lines"
    return out


def portrait_data_uri(src: Path) -> str:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    aspect = PW / PH
    ch = h
    cw = int(ch * aspect)
    cx = w * 0.555  # face sits slightly right of centre in the source picture
    x0 = int(max(0, min(w - cw, cx - cw / 2)))
    im = im.crop((x0, 0, x0 + cw, ch)).resize((PW * 2, PH * 2), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def build(portrait: Path) -> str:
    cards = []
    for i, (title, text) in enumerate(ITEMS):
        y = y0 = PY + i * (CARD_H + CARD_GAP)
        lines = balanced(text, 15, CARD_W - 44)
        y += 10 if len(lines) == 1 else 0  # centre single-line descriptions
        cards.append(
            f'<rect x="{CARD_X}" y="{y0}" width="{CARD_W}" height="{CARD_H}" rx="11" fill="#101e2c" stroke="#25394c"/>'
            f'<rect x="{CARD_X + 22}" y="{y + 21}" width="7" height="7" rx="2" fill="#39d0d8" filter="url(#dg)"/>'
            f'<text class="s" x="{CARD_X + 40}" y="{y + 30}" font-size="17" font-weight="700" fill="#e6edf3">{escape(title)}</text>'
            + "".join(
                f'<text class="s" x="{CARD_X + 22}" y="{y + 56 + k * 21}" font-size="15" fill="#c5d4e3">{escape(line)}</text>' for k, line in enumerate(lines)
            )
        )

    corners = []
    for px, py, dx, dy in ((PX - 7, PY - 7, 1, 1), (PX + PW + 7, PY - 7, -1, 1), (PX - 7, PY + PH + 7, 1, -1), (PX + PW + 7, PY + PH + 7, -1, -1)):
        corners.append(f"M{px} {py + dy * 22}V{py}H{px + dx * 22}")

    portrait_svg = (
        f'<rect x="{PX - 2}" y="{PY - 2}" width="{PW + 4}" height="{PH + 4}" rx="18" stroke="url(#pf)" stroke-width="4" opacity=".6" filter="url(#pglow)"/>'
        f'<g clip-path="url(#pclip)"><image href="{portrait_data_uri(portrait)}" x="{PX}" y="{PY}" width="{PW}" height="{PH}" preserveAspectRatio="xMidYMid slice"/>'
        f'<rect x="{PX}" y="{PY}" width="{PW}" height="{PH}" fill="url(#ptint)"/>'
        f'<rect x="{PX}" y="{PY + PH - 70}" width="{PW}" height="70" fill="url(#pfade)"/></g>'
        f'<rect x="{PX + .75}" y="{PY + .75}" width="{PW - 1.5}" height="{PH - 1.5}" rx="15.5" stroke="url(#pf)" stroke-width="1.5"/>'
        f'<path d="{" ".join(corners)}" stroke="#5ee6cf" stroke-width="2" stroke-linecap="round" opacity=".85"/>'
        f'<circle cx="{PX + 20}" cy="{PY + PH - 22}" r="3.5" fill="#42d6a4" filter="url(#dg)"/>'
        f'<text class="m" x="{PX + 31}" y="{PY + PH - 18}" font-size="11.5" font-weight="600" letter-spacing=".6" fill="#d9ecff">~/amirhossein-shojaei</text>'
    )

    desc = " ".join(f"{t}: {x}" for t, x in ITEMS)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d" fill="none">
<title id="t">01 / About me</title>
<desc id="d">Portrait of Amirhossein Shojaei. {escape(desc)}</desc>
<style>.s{{font-family:{SANS}}}.m{{font-family:{MONO}}}
.lg{{animation:pulse 8s ease-in-out infinite}}
@keyframes pulse{{0%,100%{{opacity:.09}}50%{{opacity:.24}}}}
@media (prefers-reduced-motion:reduce){{*{{animation:none!important}}}}</style>
<defs>
{LINUX}
{NGINX}
<filter id="gl-linux" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#f5b000" flood-opacity=".75"/></filter>
<filter id="gl-nginx" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#009639" flood-opacity=".75"/></filter>
<filter id="dg" x="-200%" y="-200%" width="500%" height="500%"><feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#39d0d8" flood-opacity=".9"/></filter>
<filter id="pglow" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="7"/></filter>
<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111a25"/><stop offset="1" stop-color="#0f1721"/></linearGradient>
<linearGradient id="hl" x1="0" x2="1"><stop stop-color="#315678"/><stop offset="1" stop-color="#315678" stop-opacity="0"/></linearGradient>
<linearGradient id="pf" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5ee6cf"/><stop offset=".5" stop-color="#2f6f8f"/><stop offset="1" stop-color="#58a6ff"/></linearGradient>
<linearGradient id="ptint" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5ee6cf" stop-opacity=".10"/><stop offset=".5" stop-color="#5ee6cf" stop-opacity="0"/><stop offset="1" stop-color="#1f6feb" stop-opacity=".16"/></linearGradient>
<linearGradient id="pfade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#07111a" stop-opacity="0"/><stop offset="1" stop-color="#07111a" stop-opacity=".88"/></linearGradient>
<clipPath id="pclip"><rect x="{PX}" y="{PY}" width="{PW}" height="{PH}" rx="16"/></clipPath>
<clipPath id="pc"><rect x="1" y="1" width="{W - 2}" height="{H - 2}" rx="16"/></clipPath>
</defs>
<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="16" fill="url(#pg)" stroke="#263647"/>
<g clip-path="url(#pc)"><g class="lg" opacity="0.14" style="animation-duration:9s;animation-delay:-1s" filter="url(#gl-linux)"><use href="#lg-linux" x="838" y="4" width="58" height="58"/></g><g class="lg" opacity="0.14" style="animation-duration:8s;animation-delay:-4s" filter="url(#gl-nginx)"><use href="#lg-nginx" x="{W - 54}" y="{H - 66}" width="60" height="60"/></g></g>
<text class="m" x="40" y="50" font-size="17" font-weight="600" letter-spacing="0.6" textLength="140.4" lengthAdjust="spacingAndGlyphs"><tspan fill="#5ee6cf">01</tspan><tspan fill="#9ecbff"> / ABOUT ME</tspan></text>
<rect x="194.4" y="44" width="665.6" height="1" fill="url(#hl)"/>
{portrait_svg}
{"".join(cards)}
</svg>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--portrait", default=str(ROOT / "assets" / "pic.png"))
    ap.add_argument("--out", default=str(ROOT / "assets" / "about.svg"))
    a = ap.parse_args()
    svg = build(Path(a.portrait))
    Path(a.out).write_text(svg, encoding="utf-8")
    print(f"wrote {a.out} ({len(svg) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
