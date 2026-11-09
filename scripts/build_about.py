#!/usr/bin/env python3
"""Builds assets/about.svg — the description cards of the "01 / About me" section.

    python3 scripts/build_about.py

The section opens with the animated portrait card (assets/unstoppable.gif, which carries the
"01 / ABOUT ME" heading; see scripts/unstoppable/). This card sits directly underneath it and holds
the four focus areas in the original 2x2 layout and wording.
"""

import argparse
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]

# Content and line breaks preserved verbatim from the original About me card.
ITEMS = [
    ("Full-Stack Development", ["Building frontend experiences and backend", "services for real products."]),
    ("Shopify Applications", ["Exploring embedded apps, storefront", "experiences, and platform integrations."]),
    ("Infrastructure & Delivery", ["Working with Linux, containers, deployment,", "and production environments."]),
    ("AI-Powered Products", ["Integrating AI capabilities and external", "APIs into useful application workflows."]),
]

W = 900
TOP = 26
CARD_W, CARD_H, GAP = 403, 118, 14
H = TOP + 2 * CARD_H + GAP + 26

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


def build() -> str:
    cards = []
    for i, (title, lines) in enumerate(ITEMS):
        x = 40 + (i % 2) * (CARD_W + GAP)
        y = TOP + (i // 2) * (CARD_H + GAP)
        cards.append(
            f'<rect x="{x}" y="{y}" width="{CARD_W}" height="{CARD_H}" rx="11" fill="#101e2c" stroke="#25394c"/>\n'
            f'<rect x="{x + 22}" y="{y + 27}" width="7" height="7" rx="2" fill="#39d0d8" filter="url(#dg)"/>\n'
            f'<text class="s" x="{x + 40}" y="{y + 36}" font-size="17.5" font-weight="700" fill="#e6edf3">{escape(title)}</text>\n'
            + "".join(f'<text class="s" x="{x + 22}" y="{y + 66 + k * 23}" font-size="15.5" fill="#c5d4e3">{escape(line)}</text>\n' for k, line in enumerate(lines))
        )
    desc = " ".join(f"{t}: {' '.join(ls)}" for t, ls in ITEMS)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="t d" fill="none">
<title id="t">About me — focus areas</title>
<desc id="d">{escape(desc)}</desc>
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
<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111a25"/><stop offset="1" stop-color="#0f1721"/></linearGradient>
<clipPath id="pc"><rect x="1" y="1" width="{W - 2}" height="{H - 2}" rx="16"/></clipPath>
</defs>
<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="16" fill="url(#pg)" stroke="#263647"/>
<g clip-path="url(#pc)"><g class="lg" opacity="0.14" style="animation-duration:9s;animation-delay:-1s" filter="url(#gl-linux)"><use href="#lg-linux" x="838" y="-14" width="58" height="58"/></g><g class="lg" opacity="0.14" style="animation-duration:8s;animation-delay:-4s" filter="url(#gl-nginx)"><use href="#lg-nginx" x="-12" y="{H - 48}" width="60" height="60"/></g></g>
{"".join(cards)}</svg>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=str(ROOT / "assets" / "about.svg"))
    a = ap.parse_args()
    svg = build()
    Path(a.out).write_text(svg, encoding="utf-8")
    print(f"wrote {a.out} ({len(svg) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
