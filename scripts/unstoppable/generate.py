#!/usr/bin/env python3
"""UNSTOPPABLE card: a snake eats the portrait and reveals the logo underneath.

    python3 scripts/unstoppable/generate.py [--portrait assets/pic.png] [--fps 20]

Requires: Python 3.10+, Pillow, ffmpeg, Chrome/Chromium (for the SVG layers).

Layering per frame (bottom → top):
  card background · [logo ← composited under → portrait, through the eat mask] · stage frame
  · snake glow · snake · particles · HUD
The eat mask is cumulative: every bite turns part of the portrait transparent, so the logo shows
through exactly where the snake has eaten. When the mask is full the whole logo is visible.

Outputs: assets/unstoppable.gif (animation) and assets/unstoppable-static.png (fallback frame).
"""

import argparse
import math
import random
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageStat

sys.path.insert(0, str(Path(__file__).resolve().parent))
import layers  # noqa: E402
from layers import CARD_H, CARD_W, STAGE, STAGE_R, STAGE_X, STAGE_Y  # noqa: E402
from render import svg_to_png  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

# ------------------------------------------------------------------ timeline (seconds)
INTRO = 1.0  # full portrait, snake approaching
EAT = 9.6  # snake crosses the stage
HOLD = 2.6  # full logo (snake leaves, sheen sweeps)
RESET = 1.1  # portrait re-materialises top → bottom
BITE_R = 42  # radius of the eaten swath around the head
SS = 2  # supersampling for the snake layer
BODY_LEN = 250
SEG = 3.0

# ------------------------------------------------------------------ helpers


def font(size, bold=True):
    names = ["LiberationMono-Bold.ttf", "DejaVuSansMono-Bold.ttf"] if bold else ["LiberationMono-Regular.ttf", "DejaVuSansMono.ttf"]
    for base in ("/usr/share/fonts/truetype/liberation", "/usr/share/fonts/truetype/dejavu", "/Library/Fonts", "C:/Windows/Fonts"):
        for n in names:
            p = Path(base) / n
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(int(round(lerp(a, b, t))) for a, b in zip(c1, c2))


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


TEAL, EMERALD, BLUE, DEEP = hexrgb("#5ee6cf"), hexrgb("#3ddc97"), hexrgb("#3b8cff"), hexrgb("#062b2e")
PAGE_BG = hexrgb("#0d1117")  # GitHub dark-theme page background


def body_color(t):
    """turquoise head → emerald → electric blue tail"""
    return mix(TEAL, EMERALD, t / 0.5) if t < 0.5 else mix(EMERALD, BLUE, (t - 0.5) / 0.5)


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ path


def build_path():
    """Serpentine sweep across the stage with rounded U-turns and a gentle slither, in card coords."""
    rows = 7
    top, bottom = 22, STAGE - 22
    step = (bottom - top) / (rows - 1)
    x_l, x_r = STAGE_X - 14, STAGE_X + STAGE + 14
    pts = []

    def line(x0, y0, x1, y1):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0)))
        for i in range(n):
            pts.append((lerp(x0, x1, i / n), lerp(y0, y1, i / n)))

    y = STAGE_Y + top
    line(-BODY_LEN - 420, y, x_l, y)
    for k in range(rows):
        y = STAGE_Y + top + k * step
        going_right = k % 2 == 0
        line(x_l if going_right else x_r, y, x_r if going_right else x_l, y)
        if k < rows - 1:
            cx = x_r if going_right else x_l
            r = step / 2
            n = int(math.pi * r)
            for i in range(n):
                a = -math.pi / 2 + math.pi * i / n
                pts.append((cx + (1 if going_right else -1) * r * math.cos(a), y + r + r * math.sin(a)))
    line(pts[-1][0], pts[-1][1], CARD_W + BODY_LEN + 80, pts[-1][1])

    # resample at 1 px and add a lateral slither
    out = [pts[0]]
    for p in pts[1:]:
        if math.dist(p, out[-1]) >= 1:
            out.append(p)
    wav = []
    for i, (x, y) in enumerate(out):
        a, b = out[max(0, i - 2)], out[min(len(out) - 1, i + 2)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1
        off = 5.5 * math.sin(i / 23.0)
        wav.append((x - dy / d * off, y + dx / d * off))
    return wav


def stage_enter_index(path):
    for i, (x, _) in enumerate(path):
        if x >= STAGE_X - BITE_R:
            return i
    return 0


def stage_exit_index(path):
    last = 0
    for i, (x, y) in enumerate(path):
        if STAGE_X - BITE_R <= x <= STAGE_X + STAGE + BITE_R and STAGE_Y - BITE_R <= y <= STAGE_Y + STAGE + BITE_R:
            last = i
    return last


def at(path, s):
    i = max(0, min(len(path) - 2, int(s)))
    f = min(1.0, max(0.0, s - i))
    (x0, y0), (x1, y1) = path[i], path[i + 1]
    return x0 + (x1 - x0) * f, y0 + (y1 - y0) * f


def heading(path, s):
    a, b = at(path, s - 4), at(path, s + 4)
    return math.atan2(b[1] - a[1], b[0] - a[0])


# ------------------------------------------------------------------ snake drawing (supersampled)


def draw_snake(path, s, t, chomp):
    big = Image.new("RGBA", (CARD_W * SS, CARD_H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    n = int(BODY_LEN / SEG)
    segs = []
    for k in range(n, 0, -1):
        u = k / n
        x, y = at(path, s - k * SEG)
        r = lerp(17.5, 3.6, u ** 1.15) * (1 + 0.05 * math.sin(t * 7 - k * 0.45))
        segs.append((x, y, r, u))

    def circ(x, y, r, fill):
        d.ellipse([(x - r) * SS, (y - r) * SS, (x + r) * SS, (y + r) * SS], fill=fill)

    for x, y, r, u in segs:  # rim
        circ(x, y, r + 1.6, DEEP + (255,))
    for x, y, r, u in segs:  # body
        circ(x, y, r, body_color(u) + (255,))
    for i, (x, y, r, u) in enumerate(segs):  # light from the top-left
        circ(x - r * 0.28, y - r * 0.34, r * 0.5, mix(body_color(u), (255, 255, 255), 0.28) + (255,))
        if i % 6 == 0 and r > 6:  # dorsal scale marks
            circ(x, y, r * 0.22, mix(body_color(u), DEEP, 0.5) + (255,))

    # head
    hx, hy = at(path, s)
    ang = heading(path, s) + 0.10 * math.sin(t * 5.2)
    ca, sa = math.cos(ang), math.sin(ang)
    sc = 1.28 * (1 + 0.12 * chomp)

    def tf(px, py):
        px, py = px * sc, py * sc
        return ((hx + px * ca - py * sa) * SS, (hy + px * sa + py * ca) * SS)

    outline = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        px = -10 + 24 * math.cos(a)
        py = 16.5 * math.sin(a) * (1 - 0.30 * max(0.0, math.cos(a)))
        outline.append((px, py))
    d.polygon([tf(px * 1.08 + 0.4, py * 1.12) for px, py in outline], fill=DEEP + (255,))
    d.polygon([tf(px, py) for px, py in outline], fill=hexrgb("#3fdcc8") + (255,))
    d.polygon([tf(px * 0.72 - 2, py * 0.45 - 6.5) for px, py in outline], fill=(124, 236, 222, 255))
    # tongue flick
    flick = max(0.0, math.sin(t * 9.0)) ** 2 if (t % 1.3) < 0.5 else 0
    if flick > 0.05:
        L = 15 * flick
        d.line([tf(13, 0), tf(13 + L, 0)], fill=(255, 92, 140, 255), width=int(2.4 * SS))
        d.line([tf(13 + L, 0), tf(17 + L, -4)], fill=(255, 92, 140, 255), width=int(2 * SS))
        d.line([tf(13 + L, 0), tf(17 + L, 4)], fill=(255, 92, 140, 255), width=int(2 * SS))
    # nostrils, cheeks
    for sy in (-1, 1):
        cx, cy = tf(10.5, sy * 3.4)
        d.ellipse([cx - 1.6 * SS * sc, cy - 1.6 * SS * sc, cx + 1.6 * SS * sc, cy + 1.6 * SS * sc], fill=(6, 60, 62, 255))
        cx, cy = tf(-6, sy * 12.5)
        d.ellipse([cx - 3.4 * SS * sc, cy - 3.4 * SS * sc, cx + 3.4 * SS * sc, cy + 3.4 * SS * sc], fill=(88, 226, 214, 255))
    # eyes (blink every ~3.3 s)
    blink = 0.15 if (t % 3.3) > 3.18 else 1.0
    for sy in (-1, 1):
        ex, ey = tf(0.5, sy * 8.6)
        rr = 6.2 * sc * SS
        d.ellipse([ex - rr, ey - rr * blink, ex + rr, ey + rr * blink], fill=(6, 50, 52, 255))
        rr = 5.0 * sc * SS
        d.ellipse([ex - rr, ey - rr * blink, ex + rr, ey + rr * blink], fill=(240, 255, 253, 255))
        if blink > 0.5:
            px, py = tf(2.2, sy * 8.6)
            pw, ph = 1.9 * sc * SS, 3.9 * sc * SS
            d.ellipse([px - pw, py - ph, px + pw, py + ph], fill=(3, 20, 26, 255))
            gx, gy = tf(3.0, sy * 8.6 - 2.0)
            d.ellipse([gx - 1.4 * SS * sc, gy - 1.4 * SS * sc, gx + 1.4 * SS * sc, gy + 1.4 * SS * sc], fill=(255, 255, 255, 255))
    return big.resize((CARD_W, CARD_H), Image.LANCZOS)


# ------------------------------------------------------------------ particles


class Particles:
    def __init__(self, seed=7):
        self.rnd = random.Random(seed)
        self.items = []

    def spawn(self, x, y, ang, portrait):
        for _ in range(7):
            a = ang + self.rnd.uniform(-1.9, 1.9) + math.pi * self.rnd.choice((0, 0, 1))
            off = self.rnd.uniform(-BITE_R * 0.8, BITE_R * 0.8)
            px = x + math.cos(ang) * BITE_R * 0.55 - math.sin(ang) * off
            py = y + math.sin(ang) * BITE_R * 0.55 + math.cos(ang) * off
            sx, sy = int(px - STAGE_X), int(py - STAGE_Y)
            if not (0 <= sx < STAGE and 0 <= sy < STAGE):
                continue
            col = portrait.getpixel((sx, sy))[:3]
            sp = self.rnd.uniform(40, 140)
            self.items.append({"x": px, "y": py, "vx": math.cos(a) * sp, "vy": math.sin(a) * sp, "life": 0.0,
                               "max": self.rnd.uniform(0.45, 0.85), "size": self.rnd.uniform(2.0, 5.0), "col": col, "glow": False})
        for _ in range(2):
            a = self.rnd.uniform(0, 2 * math.pi)
            sp = self.rnd.uniform(60, 160)
            self.items.append({"x": x + math.cos(ang) * 20, "y": y + math.sin(ang) * 20, "vx": math.cos(a) * sp, "vy": math.sin(a) * sp,
                               "life": 0.0, "max": self.rnd.uniform(0.3, 0.6), "size": self.rnd.uniform(1.5, 2.6),
                               "col": self.rnd.choice((TEAL, EMERALD, (180, 255, 245))), "glow": True})

    def step(self, dt):
        for p in self.items:
            p["life"] += dt
            p["x"] += p["vx"] * dt
            p["y"] += p["vy"] * dt
            p["vx"] *= 0.9
            p["vy"] = p["vy"] * 0.9 + 30 * dt
        self.items = [p for p in self.items if p["life"] < p["max"]]

    def draw(self, layer):
        d = ImageDraw.Draw(layer)
        for p in self.items:
            k = 1 - p["life"] / p["max"]
            s = p["size"] * (0.4 + 0.6 * k)
            a = int(255 * k)
            if p["glow"]:
                d.ellipse([p["x"] - s, p["y"] - s, p["x"] + s, p["y"] + s], fill=p["col"] + (a,))
            else:
                d.rectangle([p["x"] - s / 2, p["y"] - s / 2, p["x"] + s / 2, p["y"] + s / 2], fill=p["col"] + (a,), outline=TEAL + (int(a * 0.5),))


# ------------------------------------------------------------------ main


def crop_portrait(src: Path):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    side = int(min(w, h) * 0.76)
    # framed on the face: horizontally centred slightly right, upper third
    cx, cy = w * 0.52, h * 0.40
    x0 = int(max(0, min(w - side, cx - side / 2)))
    y0 = int(max(0, min(h - side, cy - side / 2)))
    return im.crop((x0, y0, x0 + side, y0 + side)).resize((STAGE, STAGE), Image.LANCZOS)


def rounded_mask(size, r):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], r * 4, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--portrait", default=str(ROOT / "assets" / "pic.png"))
    ap.add_argument("--out-gif", default=str(ROOT / "assets" / "unstoppable.gif"))
    ap.add_argument("--out-static", default=str(ROOT / "assets" / "unstoppable-static.png"))
    ap.add_argument("--fps", type=int, default=20)
    ap.add_argument("--frames-dir", help="keep rendered PNG frames here (for inspection)")
    args = ap.parse_args()
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required")

    work = Path(args.frames_dir) if args.frames_dir else Path(tempfile.mkdtemp(prefix="unstoppable-"))
    work.mkdir(parents=True, exist_ok=True)
    print("rendering SVG layers…")
    under = Image.open(svg_to_png(layers.card_under_svg(), CARD_W, CARD_H, work / "_under.png")).convert("RGBA")
    over = Image.open(svg_to_png(layers.card_over_svg(), CARD_W, CARD_H, work / "_over.png")).convert("RGBA")
    logo = Image.open(svg_to_png(layers.logo_svg(), STAGE, STAGE, work / "_logo.png")).convert("RGB")
    mark = Image.open(svg_to_png(layers.logo_svg(mark_only=True), STAGE, STAGE, work / "_mark.png")).convert("RGBA")
    portrait = crop_portrait(Path(args.portrait))
    stage_mask = rounded_mask(STAGE, STAGE_R)
    card_alpha = under.getchannel("A")

    path = build_path()
    enter_i, exit_i = stage_enter_index(path), stage_exit_index(path)
    speed = (exit_i - enter_i) / EAT  # px per second along the path
    s0 = enter_i - speed * INTRO

    fps = args.fps
    dt = 1 / fps
    total = INTRO + EAT + HOLD + RESET
    n_frames = int(round(total * fps))
    eaten = Image.new("L", (STAGE, STAGE), 0)
    bite = ImageDraw.Draw(eaten)
    parts = Particles()
    rnd = random.Random(3)
    f_big, f_small = font(30), font(11)
    twinkles = [(rnd.uniform(30, CARD_W - 30), rnd.uniform(70, CARD_H - 40), rnd.uniform(0, 6.28), rnd.uniform(1.2, 2.4)) for _ in range(16)]
    twinkles = [p for p in twinkles if not (STAGE_X - 20 < p[0] < STAGE_X + STAGE + 20)]
    last_s = s0
    static_frame = None
    print(f"rendering {n_frames} frames at {fps} fps…")

    for fi in range(n_frames):
        t = fi * dt
        s = s0 + speed * t
        phase_hold = t >= INTRO + EAT
        phase_reset = t >= INTRO + EAT + HOLD

        # --- bites: stamp the eaten swath along the path travelled since the last frame
        if not phase_hold:
            k = last_s
            while k <= s:
                x, y = at(path, k)
                jitter = rnd.uniform(-2.5, 2.5)
                r = BITE_R + jitter
                bite.ellipse([x - STAGE_X - r, y - STAGE_Y - r, x - STAGE_X + r, y - STAGE_Y + r], fill=255)
                k += 3
        last_s = s
        if phase_hold and not phase_reset:
            # guarantee a fully consumed portrait: absorb any leftover specks in the first moments of the hold
            u = smoothstep((t - INTRO - EAT) / 0.25)
            eaten = Image.eval(eaten, lambda v, u=u: int(v + (255 - v) * u))
            bite = ImageDraw.Draw(eaten)
        reset_y = None
        cover = eaten
        if phase_reset:
            u = smoothstep((t - INTRO - EAT - HOLD) / (RESET - 0.15))
            reset_y = int(u * (STAGE + 8))
            cover = eaten.copy()
            ImageDraw.Draw(cover).rectangle([0, 0, STAGE, reset_y], fill=0)

        consumed = ImageStat.Stat(cover).mean[0] / 255

        # --- stage: portrait over logo, cut by the eat mask
        logo_f = logo.copy()
        if phase_hold:
            # sheen sweeping across the emblem + wordmark
            u = (t - INTRO - EAT - 0.3) / 1.5
            if 0 <= u <= 1:
                band = Image.new("L", (STAGE, STAGE), 0)
                bx = lerp(-120, STAGE + 120, u)
                ImageDraw.Draw(band).polygon([(bx, 0), (bx + 46, 0), (bx - 54, STAGE), (bx - 100, STAGE)], fill=150)
                band = band.filter(ImageFilter.GaussianBlur(14))
                band = ImageChops.multiply(band, mark.getchannel("A"))
                logo_f = Image.composite(Image.new("RGB", (STAGE, STAGE), (235, 255, 250)), logo_f, band)
        stage = Image.composite(logo_f, portrait, cover)
        if 0.002 < consumed < 0.999 or reset_y is not None:
            edge_src = cover
            rim = ImageChops.subtract(edge_src.filter(ImageFilter.MaxFilter(9)), edge_src)
            if reset_y is not None and reset_y < STAGE:
                ImageDraw.Draw(rim).rectangle([0, max(0, reset_y - 2), STAGE, min(STAGE, reset_y + 2)], fill=255)
            rim = rim.filter(ImageFilter.GaussianBlur(2.2))
            rim = Image.eval(rim, lambda v: min(255, int(v * 1.6)))
            stage = Image.composite(Image.new("RGB", (STAGE, STAGE), (120, 255, 230)), stage, rim)

        frame = under.copy()
        frame.paste(stage, (STAGE_X, STAGE_Y), stage_mask)
        frame.alpha_composite(over)

        # --- twinkling background particles
        d = ImageDraw.Draw(frame)
        for x, y, ph, sp in twinkles:
            a = int(110 * max(0.0, math.sin(t * sp + ph)) ** 3)
            if a > 8:
                d.ellipse([x - 1.6, y - 1.6, x + 1.6, y + 1.6], fill=TEAL + (a,))

        # --- snake + particles
        on_card = at(path, s)[0] < CARD_W + BODY_LEN
        eating = INTRO - 0.1 < t < INTRO + EAT + 0.1
        chomp = max(0.0, math.sin(t * 2 * math.pi / 0.42)) ** 4 if eating else 0.0
        if eating:
            hx, hy = at(path, s)
            if STAGE_X - 10 < hx < STAGE_X + STAGE + 10:
                parts.spawn(hx, hy, heading(path, s), portrait)
        parts.step(dt)
        if on_card and not phase_reset:
            snake = draw_snake(path, s, t, chomp)
            glow = snake.filter(ImageFilter.GaussianBlur(9))
            ga = glow.getchannel("A").point(lambda v: int(v * 0.75))
            glow = Image.merge("RGBA", (*Image.new("RGB", glow.size, (60, 230, 205)).split(), ga))
            frame.alpha_composite(glow)
            frame.alpha_composite(snake)
        if parts.items:
            pl = Image.new("RGBA", frame.size, (0, 0, 0, 0))
            parts.draw(pl)
            frame.alpha_composite(pl.filter(ImageFilter.GaussianBlur(0.6)))
            frame.alpha_composite(pl)

        # --- HUD
        d = ImageDraw.Draw(frame)
        pct = f"{int(round(consumed * 100))}%"
        d.text((48, 302), pct, font=f_big, fill=TEAL + (255,))
        d.text((CARD_W - 48, 302), pct, font=f_big, fill=hexrgb("#79c0ff") + (255,), anchor="ra")
        if consumed > 0.005:
            d.rounded_rectangle([48, 342, 48 + 140 * consumed, 347], 2.5, fill=TEAL + (255,))
            d.rounded_rectangle([CARD_W - 48 - 140 * consumed, 342, CARD_W - 48, 347], 2.5, fill=hexrgb("#79c0ff") + (255,))
        status = "RESTORING…" if phase_reset else ("UNSTOPPABLE ✓" if phase_hold else ("EATING…" if t >= INTRO else "READY"))
        d.text((48, 366), status if not status.startswith("UNSTOPPABLE") else "COMPLETE", font=f_small, fill=hexrgb("#6f8498") + (255,))

        # Opaque output: GIF transparency would disable ffmpeg's frame-diff optimisation (≈18x larger).
        # Corners are filled with GitHub's dark page colour so the card still reads as rounded there.
        frame.putalpha(ImageChops.multiply(frame.getchannel("A"), card_alpha))
        flat = Image.new("RGBA", frame.size, PAGE_BG + (255,))
        flat.alpha_composite(frame)
        frame = flat.convert("RGB")
        frame.save(work / f"f{fi:04d}.png")
        if static_frame is None and consumed >= 0.55:
            static_frame = frame.copy()
        if fi % 40 == 0:
            print(f"  frame {fi}/{n_frames}  consumed={consumed:.3f}")

    # --- encode: one global palette, ordered dither (temporally stable), transparent-diff frames
    gif = Path(args.out_gif)
    print("encoding GIF…")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", str(work / "f%04d.png"),
        "-filter_complex",
        "[0:v]split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];"
        "[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
        "-loop", "0", str(gif),
    ], check=True)
    static_frame.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(args.out_static, optimize=True)
    print(f"wrote {gif} ({gif.stat().st_size / 1e6:.2f} MB, {n_frames} frames) and {args.out_static}")
    if not args.frames_dir:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
