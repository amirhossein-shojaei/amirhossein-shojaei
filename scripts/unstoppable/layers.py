"""SVG layers for the UNSTOPPABLE card (rendered to PNG with headless Chrome).

All coordinates are card pixels. The wordmark is drawn from custom chamfered
stroke glyphs (no font dependency), so it renders identically everywhere.
"""

CARD_W, CARD_H = 900, 590
STAGE_X, STAGE_Y, STAGE = 230, 78, 440
STAGE_R = 20

TEAL, EMERALD, BLUE = "#5ee6cf", "#42d6a4", "#58a6ff"
MONO = "'JetBrains Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace"

# ---------------------------------------------------------------- wordmark glyphs
# Centerline paths on a 66 x 100 cell (stroke width 19 → letters fill the cell).
_A, _B, _T, _M, _BT, _C = 9.5, 56.5, 9.5, 50, 90.5, 11


def _glyphs():
    a, b, t, m, bt, c = _A, _B, _T, _M, _BT, _C
    return {
        "U": f"M{a} {t}V{bt-c}L{a+c} {bt}H{b-c}L{b} {bt-c}V{t}",
        "N": f"M{a} {bt}V{t}L{b} {bt}V{t}",
        "S": f"M{b} {t}H{a+c}L{a} {t+c}V{m-c}L{a+c} {m}H{b-c}L{b} {m+c}V{bt-c}L{b-c} {bt}H{a}",
        "T": f"M{a-6} {t}H{b+6}M{(a+b)/2} {t}V{bt}",
        "O": f"M{a+c} {t}H{b-c}L{b} {t+c}V{bt-c}L{b-c} {bt}H{a+c}L{a} {bt-c}V{t+c}Z",
        "P": f"M{a} {bt}V{t}H{b-c}L{b} {t+c}V{m-c}L{b-c} {m}H{a}",
        "A": f"M{a} {bt}V{t+18}L{a+18} {t}H{b-18}L{b} {t+18}V{bt}M{a} {m+8}H{b}",
        "B": f"M{a} {t}V{bt}H{b-c}L{b} {bt-c}V{m+c}L{b-c} {m}H{a}M{a} {t}H{b-c-5}L{b-5} {t+c}V{m-c}L{b-c-5} {m}",
        "L": f"M{a} {t}V{bt}H{b}",
        "E": f"M{b} {t}H{a}V{bt}H{b}M{a} {m}H{b-9}",
    }


def wordmark_paths(word="UNSTOPPABLE", advance=74):
    g = _glyphs()
    return "".join(f'<path transform="translate({i * advance} 0)" d="{g[ch]}"/>' for i, ch in enumerate(word)), len(word) * advance - 8


# ---------------------------------------------------------------- logo (inside the stage)

def logo_svg(mark_only=False):
    """The logo stage (440x440). mark_only=True → just emblem + wordmark on transparent bg (for the sheen)."""
    paths, units = wordmark_paths()
    scale = 396 / (units + 18)  # room for the skew
    wm_x = (STAGE - (units + 18) * scale) / 2 + 2
    wm_y = 282
    cx, cy = STAGE / 2, 158

    def hexagon(r, rot=30):
        import math
        pts = [(cx + r * math.cos(math.radians(rot + 60 * k)), cy + r * math.sin(math.radians(rot + 60 * k))) for k in range(6)]
        return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z", pts

    outer, outer_pts = hexagon(80)
    inner, _ = hexagon(66)
    ring, _ = hexagon(94)

    word = f'<g transform="translate({wm_x:.1f} {wm_y}) scale({scale:.4f}) skewX(-11) translate(18 0)" stroke-width="22" stroke-linejoin="miter" stroke-miterlimit="2" fill="none">'
    mark = []
    # emblem
    mark.append(f'<path d="{ring}" stroke="url(#gEm)" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="3 7"/>')
    mark.append(f'<path d="{outer}" fill="url(#gHexFill)" stroke="url(#gEm)" stroke-width="4.5" filter="url(#glow)"/>')
    mark.append(f'<path d="{inner}" stroke="#7ff3e1" stroke-opacity=".25" stroke-width="1"/>')
    for x, y in outer_pts:
        mark.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="#0b1b24" stroke="{TEAL}" stroke-width="1.8"/>')
    # double forward chevron + speed trails
    chev = "M-22 -30 L8 0 L-22 30"
    mark.append(
        f'<g transform="translate({cx + 6} {cy})" stroke-linecap="square" stroke-linejoin="miter" fill="none" filter="url(#glow)">'
        f'<path d="{chev}" transform="translate(-16 0)" stroke="url(#gChev2)" stroke-width="13"/>'
        f'<path d="{chev}" transform="translate(14 0)" stroke="url(#gChev)" stroke-width="13"/>'
        f'<path d="M-62 -14H-44M-70 0H-40M-62 14H-44" stroke="{TEAL}" stroke-opacity=".55" stroke-width="3"/>'
        "</g>"
    )
    # wordmark: glow, extrusion, face, highlight, cut
    mark.append(f'{word}<g stroke="{TEAL}" stroke-opacity=".55" filter="url(#wglow)">{paths}</g></g>')
    mark.append(f'<g transform="translate(2.2 3.2)">{word}<g stroke="#06302f">{paths}</g></g></g>')
    mark.append(f'<g transform="translate(1.1 1.6)">{word}<g stroke="#0d5a55">{paths}</g></g></g>')
    mark.append(f'<g mask="url(#cut)">{word}<g stroke="url(#gWord)">{paths}</g></g></g>')
    mark.append(f'<g mask="url(#cut)" transform="translate(0 -3.2)">{word}<g stroke="#e9fffb" stroke-opacity=".45" stroke-width="4">{paths}</g></g></g>')
    # tagline + rules
    ty = wm_y + 100 * scale + 34
    mark.append(
        f'<g font-family="{MONO}" font-size="12.5" font-weight="700" letter-spacing="4.2" fill="#9ecbff" text-anchor="middle">'
        f'<text x="{cx}" y="{ty:.1f}">BUILD · SHIP · IMPROVE</text></g>'
        f'<path d="M{cx-196} {ty-4:.1f}H{cx-140}M{cx+140} {ty-4:.1f}H{cx+196}" stroke="url(#gRule)" stroke-width="1.5"/>'
        f'<path d="M{cx-150} {wm_y-22}H{cx+150}" stroke="{TEAL}" stroke-opacity=".25"/>'
        f'<path d="M{cx-12} {wm_y-22}l6 -5h12l6 5" stroke="{TEAL}" stroke-opacity=".7" stroke-width="1.4"/>'
    )

    defs = f"""
<linearGradient id="gEm" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{TEAL}"/><stop offset=".55" stop-color="{EMERALD}"/><stop offset="1" stop-color="{BLUE}"/></linearGradient>
<radialGradient id="gHexFill" cx=".5" cy=".4" r=".7"><stop stop-color="#0f3a3e"/><stop offset="1" stop-color="#08161d"/></radialGradient>
<linearGradient id="gChev" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b8fff3"/><stop offset=".5" stop-color="{TEAL}"/><stop offset="1" stop-color="{EMERALD}"/></linearGradient>
<linearGradient id="gChev2" x1="0" y1="0" x2="0" y2="1"><stop stop-color="{BLUE}"/><stop offset="1" stop-color="#2f81f7"/></linearGradient>
<linearGradient id="gWord" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="800" y2="100"><stop stop-color="#7ff6e6"/><stop offset=".45" stop-color="{TEAL}"/><stop offset="1" stop-color="#3ddc84"/></linearGradient>
<linearGradient id="gRule" x1="0" x2="1"><stop stop-color="{TEAL}" stop-opacity="0"/><stop offset=".5" stop-color="{TEAL}"/><stop offset="1" stop-color="{TEAL}" stop-opacity="0"/></linearGradient>
<filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="wglow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="{STAGE}" height="{STAGE}"><rect width="{STAGE}" height="{STAGE}" fill="#fff"/>
  <path d="M{wm_x+262:.0f} {wm_y-6}l-34 {100*scale+14:.0f}" stroke="#000" stroke-width="3.2"/></mask>
<radialGradient id="gBg" cx=".5" cy=".42" r=".75"><stop stop-color="#0f2f36"/><stop offset=".55" stop-color="#0a1720"/><stop offset="1" stop-color="#060c12"/></radialGradient>
<pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" stroke="#5ee6cf" stroke-opacity=".05"/></pattern>
"""
    bg = ""
    if not mark_only:
        traces = []
        for (x, y), (ex, ey) in zip(outer_pts, [(440, 120), (440, 300), (cx, 440), (0, 300), (0, 120), (cx, 0)]):
            mx = x + (ex - x) * 0.45
            traces.append(f"M{x:.1f} {y:.1f}L{mx:.1f} {y + (ey - y) * 0.2:.1f}L{ex} {ey}")
        bg = (
            f'<rect width="{STAGE}" height="{STAGE}" fill="url(#gBg)"/><rect width="{STAGE}" height="{STAGE}" fill="url(#grid)"/>'
            f'<path d="{" ".join(traces)}" stroke="{TEAL}" stroke-opacity=".14" stroke-width="1.2"/>'
            f'<ellipse cx="{cx}" cy="{wm_y + 30}" rx="200" ry="34" fill="{TEAL}" opacity=".06"/>'
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{STAGE}" height="{STAGE}" viewBox="0 0 {STAGE} {STAGE}" fill="none">'
        f"<defs>{defs}</defs>{bg}{''.join(mark)}</svg>"
    )


# ---------------------------------------------------------------- card chrome

def _circuits(side):
    """Circuit traces running from the card edge to the stage frame."""
    out = []
    x0, x1 = (24, STAGE_X - 8) if side == "L" else (CARD_W - 24, STAGE_X + STAGE + 8)
    sgn = 1 if side == "L" else -1
    for i, y in enumerate((150, 236, 404, 478)):
        bend = x0 + sgn * (40 + i * 14)
        y2 = y + (18 if i % 2 else -18)
        out.append(f'<path d="M{x0} {y}H{bend}L{bend + sgn * 18} {y2}H{x1}" stroke="{TEAL}" stroke-opacity=".16" stroke-width="1.2"/>')
        out.append(f'<circle cx="{x0}" cy="{y}" r="2.6" fill="#0b1720" stroke="{TEAL}" stroke-opacity=".5"/>')
        out.append(f'<circle cx="{x1}" cy="{y2}" r="2" fill="{TEAL}" fill-opacity=".55"/>')
    return "".join(out)


def card_under_svg():
    dots = []
    import random
    rnd = random.Random(11)
    for _ in range(70):
        x, y = rnd.uniform(20, CARD_W - 20), rnd.uniform(70, CARD_H - 20)
        if STAGE_X - 10 < x < STAGE_X + STAGE + 10 and STAGE_Y - 10 < y < STAGE_Y + STAGE + 10:
            continue
        dots.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.choice((0.8, 1, 1.3))}" fill="{rnd.choice((TEAL, EMERALD, BLUE, "#ffffff"))}" fill-opacity="{rnd.uniform(.12, .35):.2f}"/>')
    hud = (
        f'<g font-family="{MONO}" font-weight="700" letter-spacing="1.2">'
        f'<text x="48" y="276" font-size="10.5" fill="#6f8498">PORTRAIT.PNG</text>'
        f'<text x="48" y="294" font-size="10.5" fill="#8fb3cc">CONSUMED</text>'
        f'<rect x="48" y="342" width="140" height="5" rx="2.5" fill="#132637"/>'
        f'<text x="{CARD_W - 48}" y="276" font-size="10.5" fill="#6f8498" text-anchor="end">LOGO.SVG</text>'
        f'<text x="{CARD_W - 48}" y="294" font-size="10.5" fill="#8fb3cc" text-anchor="end">REVEALED</text>'
        f'<rect x="{CARD_W - 188}" y="342" width="140" height="5" rx="2.5" fill="#132637"/>'
        "</g>"
    )
    head = (
        f'<path d="M44 37.5 47.5 34l3.5 3.5-3.5 3.5Z" fill="{TEAL}"/>'
        f'<text x="58" y="42" font-family="{MONO}" font-size="13" font-weight="700" letter-spacing=".8" fill="#9ecbff">UNSTOPPABLE</text>'
        f'<rect x="174" y="37" width="520" height="1" fill="url(#hl)"/>'
        f'<text x="860" y="42" font-family="{MONO}" font-size="11" fill="#6f8498" text-anchor="end">snake.eat(portrait)</text>'
        f'<text x="450" y="{CARD_H - 26}" font-family="{MONO}" font-size="11.5" fill="#6f8498" text-anchor="middle">// every bite reveals what was underneath</text>'
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{CARD_W}" height="{CARD_H}" viewBox="0 0 {CARD_W} {CARD_H}" fill="none">
<defs>
<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0d1520"/><stop offset=".6" stop-color="#080d14"/><stop offset="1" stop-color="#060a10"/></linearGradient>
<radialGradient id="lt" cx=".5" cy=".5" r=".5"><stop stop-color="{TEAL}" stop-opacity=".16"/><stop offset="1" stop-color="{TEAL}" stop-opacity="0"/></radialGradient>
<radialGradient id="lt2" cx=".5" cy=".5" r=".5"><stop stop-color="{BLUE}" stop-opacity=".10"/><stop offset="1" stop-color="{BLUE}" stop-opacity="0"/></radialGradient>
<linearGradient id="hl" x1="0" x2="1"><stop stop-color="#315678"/><stop offset="1" stop-color="#315678" stop-opacity="0"/></linearGradient>
<clipPath id="cc"><rect x="1" y="1" width="{CARD_W - 2}" height="{CARD_H - 2}" rx="16"/></clipPath>
</defs>
<rect x=".5" y=".5" width="{CARD_W - 1}" height="{CARD_H - 1}" rx="16" fill="url(#pg)" stroke="#263647"/>
<g clip-path="url(#cc)">
<ellipse cx="{STAGE_X + STAGE / 2}" cy="{STAGE_Y + STAGE / 2}" rx="380" ry="300" fill="url(#lt)"/>
<ellipse cx="760" cy="520" rx="260" ry="180" fill="url(#lt2)"/>
<ellipse cx="120" cy="120" rx="220" ry="160" fill="url(#lt2)"/>
{''.join(dots)}{_circuits('L')}{_circuits('R')}
</g>
<rect x="{STAGE_X - 6}" y="{STAGE_Y - 6}" width="{STAGE + 12}" height="{STAGE + 12}" rx="{STAGE_R + 5}" fill="#03070b"/>
{head}{hud}
</svg>"""


def card_over_svg():
    """Frame drawn above the stage: gradient border, glow and corner brackets."""
    x, y, s, r = STAGE_X, STAGE_Y, STAGE, STAGE_R
    br = []
    for (px, py, dx, dy) in ((x - 10, y - 10, 1, 1), (x + s + 10, y - 10, -1, 1), (x - 10, y + s + 10, 1, -1), (x + s + 10, y + s + 10, -1, -1)):
        br.append(f"M{px} {py + dy * 26}V{py}H{px + dx * 26}")
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{CARD_W}" height="{CARD_H}" viewBox="0 0 {CARD_W} {CARD_H}" fill="none">
<defs>
<linearGradient id="fr" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{TEAL}"/><stop offset=".5" stop-color="#2f6f8f"/><stop offset="1" stop-color="{BLUE}"/></linearGradient>
<filter id="fg" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
<linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bff8f0" stop-opacity=".10"/><stop offset=".25" stop-color="#bff8f0" stop-opacity="0"/></linearGradient>
</defs>
<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="{r}" fill="url(#top)"/>
<rect x="{x - 1}" y="{y - 1}" width="{s + 2}" height="{s + 2}" rx="{r + 1}" stroke="url(#fr)" stroke-width="3" opacity=".55" filter="url(#fg)"/>
<rect x="{x - .75}" y="{y - .75}" width="{s + 1.5}" height="{s + 1.5}" rx="{r + .75}" stroke="url(#fr)" stroke-width="1.5"/>
<path d="{' '.join(br)}" stroke="{TEAL}" stroke-width="2" stroke-linecap="round" opacity=".85"/>
</svg>"""
