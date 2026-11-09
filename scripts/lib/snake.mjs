// Renders the contribution calendar with an animated snake that eats every active day.
//
// GitHub shows README images through <img>, so no JavaScript runs. Everything here is
// pre-computed into CSS @keyframes inside the SVG (the same mechanism the widely used
// Platane/snk action relies on), which GitHub's image proxy serves untouched.
//
// Timeline of one loop:  [snake run: enters left → eats every active cell → exits right]
//                        [refill wave: eaten cells regrow column by column] [short hold]

import { FONT_STYLE, C, esc, r2, fmtInt, fmtDate, monthName, sectionHeading, PANEL_DEFS, panel } from './svg-kit.mjs';

const W = 900;
const LEVEL_FILL = ['#141f2b', '#0e4a4f', '#127a7a', '#25b3a6', '#5ee6cf'];
const PITCH = 14;
const CELL = 11;
const ARENA = { x: 40, y: 100, w: 820 };
const GRID_Y = ARENA.y + 62;
const MIN_SEGS = 12; // body segments at the start (three per grid cell)
const MAX_SEGS = 34; // fully grown (~11 cells)
const SEG_LAG = 0.34; // grid steps between body segments (overlap → smooth tube)
const STILL_SEGS = 24;

const DIRS = { '1,0': 0, '0,1': 90, '-1,0': 180, '0,-1': -90 };

// ---------- geometry & path ----------

function buildGrid(days) {
  const offset = new Date(days[0].date + 'T00:00:00Z').getUTCDay();
  const cells = days.map((d, i) => ({ ...d, col: Math.floor((i + offset) / 7), row: (i + offset) % 7 }));
  const cols = cells[cells.length - 1].col + 1;
  return { cells, cols };
}

/** Greedy nearest-target walk on the grid. Never reverses direction (no 180° turns through its own body). */
function buildPath(cells, cols) {
  const key = (x, y) => x * 8 + y;
  const remaining = new Map(cells.filter((c) => c.level > 0).map((c) => [key(c.col, c.row), c]));
  let x = -3;
  let y = 3;
  let dx = 1;
  let dy = 0;
  const path = [[x, y]];
  const eats = []; // { step, cell }

  const stepTo = (tx, ty) => {
    while (x !== tx || y !== ty) {
      const opts = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].filter(([mx, my]) => !(mx === -dx && my === -dy) && y + my >= 0 && y + my <= 6);
      const dist = (mx, my) => Math.abs(tx - x - mx) + Math.abs(ty - y - my);
      opts.sort((a, b) => dist(...a) - dist(...b) || (b[0] === dx && b[1] === dy) - (a[0] === dx && a[1] === dy));
      let [mx, my] = opts[0];
      if (dist(mx, my) > Math.abs(tx - x) + Math.abs(ty - y)) {
        // Target is straight behind: sidestep toward the roomier half of the grid.
        const side = y < 3 ? 1 : -1;
        [mx, my] = dy === 0 ? [0, side] : [dx || 1, 0];
      }
      x += mx;
      y += my;
      dx = mx;
      dy = my;
      path.push([x, y]);
      const hit = remaining.get(key(x, y));
      if (hit) {
        remaining.delete(key(x, y));
        eats.push({ step: path.length - 1, cell: hit });
      }
    }
  };

  while (remaining.size) {
    let best = null;
    let bestD = Infinity;
    // Column sweep: only consider cells near the left-most uneaten column, so nothing is left behind.
    let minCol = Infinity;
    for (const c of remaining.values()) minCol = Math.min(minCol, c.col);
    for (const c of remaining.values()) {
      if (c.col > minCol + 2) continue;
      const ddx = c.col - x;
      const ddy = c.row - y;
      let d = Math.abs(ddx) + Math.abs(ddy);
      if (ddx * dx < 0 || ddy * dy < 0) d += 2; // targets behind the head cost a U-turn
      if (d < bestD || (d === bestD && c.col < best.col)) {
        bestD = d;
        best = c;
      }
    }
    stepTo(best.col, best.row);
  }
  stepTo(cols + 3, y === 0 || y === 6 ? 3 : y);
  return { path, eats };
}

// ---------- colour helpers ----------

function hsl(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** turquoise head → emerald mid-body → electric blue tail */
function segmentStyle(j) {
  const t = j / MAX_SEGS;
  const hue = t < 0.45 ? 176 - (t / 0.45) * 22 : 154 + ((t - 0.45) / 0.55) * 56;
  const light = 60 - t * 10 + (j % 2 ? 0 : 4); // subtle banding
  const r = 5.6 - 3.0 * Math.pow(t, 1.35);
  return { fill: hsl(hue, 82, light), rim: hsl(hue, 70, 22), r };
}

// ---------- drawing ----------

function segmentShape(j) {
  const { fill, rim, r } = segmentStyle(j);
  return (
    `<circle r="${r2(r)}" fill="${fill}" stroke="${rim}" stroke-opacity=".45" stroke-width=".6"/>` +
    `<circle cx="${r2(-r * 0.32)}" cy="${r2(-r * 0.36)}" r="${r2(r * 0.5)}" fill="url(#shine)"/>`
  );
}

function headShape(animated) {
  const a = (cls) => (animated ? ` class="${cls}"` : '');
  const eye = (y) =>
    `<g transform="translate(2.5,${y})"><g${a('bl')}>` +
    `<circle r="2.25" fill="#effffd" stroke="#0c5a5a" stroke-width=".45"/>` +
    `<ellipse cx=".55" rx=".85" ry="1.55" fill="#03141a"/>` +
    `<circle cx="1" cy="-.75" r=".5" fill="#fff"/></g></g>`;
  return (
    `<g${a('hb')}>` +
    `<g transform="translate(8.9,0)"><path${a('tg')} d="M0 0h3.6l1.5-1.2M3.6 0l1.5 1.2" stroke="#ff6b9a" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round"/></g>` +
    `<path d="M-6.2-5.7C-2-7.5 5.2-6.6 8.4-2.7c1.5 1.7 1.5 3.7 0 5.4C5.2 6.6-2 7.5-6.2 5.7c-1.7-2.2-1.7-9.2 0-11.4Z" fill="url(#hd)" stroke="#0b4f52" stroke-width=".8"/>` +
    `<path d="M-4.5-3.4C-.8-5.6 4.6-4.6 6.6-2.2" stroke="#d6fffa" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round"/>` +
    `<ellipse cx="-1.5" cy="0" rx="3.6" ry="1" fill="#0b6f6c" opacity=".35"/>` +
    `<circle cx=".6" cy="-4.9" r="1.2" fill="#9ff6ff" opacity=".28"/><circle cx=".6" cy="4.9" r="1.2" fill="#9ff6ff" opacity=".28"/>` +
    `<circle cx="7.5" cy="-1.15" r=".45" fill="#063f40"/><circle cx="7.5" cy="1.15" r=".45" fill="#063f40"/>` +
    eye(-3.2) +
    eye(3.2) +
    `</g>`
  );
}

// ---------- keyframe helpers ----------

class Timeline {
  constructor(total) {
    this.total = total;
  }
  pct(t) {
    return Math.min(100, Math.max(0, (t / this.total) * 100));
  }
  /** stops: [timeSeconds | '0%' | '100%', css]. Drops non-increasing stops. */
  keyframes(name, stops) {
    let last = -1;
    const out = [];
    for (const [t, css] of stops) {
      const p = typeof t === 'string' ? Number(t.replace('%', '')) : this.pct(t);
      const ps = +p.toFixed(3);
      if (ps <= last) continue;
      last = ps;
      out.push(`${ps}%{${css}}`);
    }
    return `@keyframes ${name}{${out.join('')}}`;
  }
}

// ---------- main render ----------

export function renderSnake(data, { animated = true, login } = {}) {
  const { cells, cols } = buildGrid(data.days);
  const gridW = cols * PITCH - (PITCH - CELL);
  const gridX = Math.round(ARENA.x + 46 + (ARENA.w - 46 - 20 - gridW) / 2);
  const gx = (c) => gridX + c * PITCH;
  const gy = (r) => GRID_Y + r * PITCH;
  const cx = (c) => gx(c) + CELL / 2;
  const cy = (r) => gy(r) + CELL / 2;
  const gridH = 7 * PITCH - (PITCH - CELL);
  const arenaH = GRID_Y - ARENA.y + gridH + 46;
  const H = ARENA.y + arenaH + 24;

  const active = cells.filter((c) => c.level > 0);
  const total = data.lastYearTotal;
  const first = data.days[0].date;
  const last = data.days[data.days.length - 1].date;

  const { path, eats } = buildPath(cells, cols);
  const steps = path.length - 1;
  const speed = Math.max(8, steps / 85); // grid steps per second; keeps a loop under ~90 s
  const dt = 1 / speed;
  const runT = steps * dt;
  const waveStart = runT + 0.35;
  const waveT = cols * 0.022 + 0.45;
  const L = +(waveStart + waveT + 1.3).toFixed(2);
  const tl = new Timeline(L);

  const posAt = (s) => {
    if (s <= 0) return path[0];
    if (s >= steps) return path[steps];
    const i = Math.floor(s);
    const f = s - i;
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    return [ax + (bx - ax) * f, ay + (by - ay) * f];
  };
  const dirAt = (i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.max(1, i)];
    return DIRS[`${b[0] - a[0]},${b[1] - a[1]}`];
  };
  const tr = ([c, r]) => `translate(${r2(cx(c))}px,${r2(cy(r))}px)`;

  const css = [FONT_STYLE];
  const defs = [PANEL_DEFS];
  const body = [];

  defs.push(
    `<radialGradient id="ab" cx=".5" cy="0" r="1.2"><stop stop-color="#0f2233"/><stop offset=".7" stop-color="#0a141e"/></radialGradient>`,
    `<pattern id="sl" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#fff" fill-opacity=".018"/></pattern>`,
    `<radialGradient id="shine"><stop stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="aura"><stop stop-color="#5ee6cf" stop-opacity=".32"/><stop offset=".55" stop-color="#39d0d8" stop-opacity=".08"/><stop offset="1" stop-color="#39d0d8" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="hd" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9af8ef"/><stop offset=".45" stop-color="#3ddcc6"/><stop offset="1" stop-color="#12928f"/></linearGradient>`,
    `<linearGradient id="pb" x1="0" x2="1"><stop stop-color="#39d0d8"/><stop offset=".55" stop-color="#42d6a4"/><stop offset="1" stop-color="#79c0ff"/></linearGradient>`,
    `<filter id="cg" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="1.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    `<filter id="sg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" result="b"/><feColorMatrix in="b" values="0 0 0 0 .2  0 0 0 0 .9  0 0 0 0 .85  0 0 0 .75 0" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
    `<filter id="dg" x="-200%" y="-200%" width="500%" height="500%"><feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="#42d6a4" flood-opacity=".9"/></filter>`,
    `<rect id="e" width="${CELL}" height="${CELL}" rx="2.6" fill="${LEVEL_FILL[0]}" stroke="#1b2a39" stroke-width=".6"/>`,
    `<path id="k" d="M0-5.5h.01M5.5 0h.01M0 5.5h.01M-5.5 0h.01" stroke="#c9fff6" stroke-width="1.8" stroke-linecap="round"/>`,
    `<clipPath id="gc"><rect x="${gridX - 8}" y="${GRID_Y - 9}" width="${gridW + 16}" height="${gridH + 18}" rx="6"/></clipPath>`,
  );

  // ----- panel, heading, arena chrome -----
  body.push(panel(W, H), sectionHeading('04', 'GITHUB ACTIVITY'));
  body.push(
    `<circle${animated ? ' class="live"' : ''} cx="46" cy="76" r="4" fill="#42d6a4" filter="url(#dg)"/>`,
    `<text class="s" x="60" y="81" font-size="14.5" fill="${C.muted}"><tspan fill="#e6edf3" font-weight="600">${fmtInt(total)} contributions</tspan> in the last year · the snake eats every active day, rebuilt from live GitHub data.</text>`,
    `<rect x="${ARENA.x}" y="${ARENA.y}" width="${ARENA.w}" height="${arenaH}" rx="12" fill="url(#ab)" stroke="#23394d"/>`,
    `<rect x="${ARENA.x + 1}" y="${ARENA.y + 1}" width="${ARENA.w - 2}" height="${arenaH - 2}" rx="11" fill="url(#sl)"/>`,
    `<g class="m" font-size="11.5"><circle cx="${ARENA.x + 20}" cy="${ARENA.y + 21}" r="3.2" fill="#42d6a4"/>` +
      `<text x="${ARENA.x + 31}" y="${ARENA.y + 25}" fill="#d9ecff" font-weight="600">contribution-snake</text>` +
      `<text x="${ARENA.x + 166}" y="${ARENA.y + 25}" fill="#5f7a90">${active.length} active days</text></g>`,
  );

  // progress HUD
  const pbW = 150;
  const pbX = ARENA.x + ARENA.w - 20 - pbW;
  body.push(
    `<text class="m" x="${pbX - 10}" y="${ARENA.y + 25}" font-size="10.5" font-weight="600" letter-spacing="1" fill="#8fb3cc" text-anchor="end">EATEN</text>`,
    `<rect x="${pbX}" y="${ARENA.y + 18}" width="${pbW}" height="5" rx="2.5" fill="#132637"/>`,
    `<rect${animated ? ' class="pb"' : ''} x="${pbX}" y="${ARENA.y + 18}" width="${pbW}" height="5" rx="2.5" fill="url(#pb)"${animated ? '' : ' opacity="0"'}/>`,
  );

  // month + weekday labels
  const labels = [];
  let lastLabelCol = -9;
  for (const c of cells) {
    const d = new Date(c.date + 'T00:00:00Z');
    if (d.getUTCDate() <= 7 && c.row === 0 && c.col - lastLabelCol >= 3) {
      labels.push(`<text x="${gx(c.col)}" y="${GRID_Y - 8}">${monthName(d.getUTCMonth())}</text>`);
      lastLabelCol = c.col;
    }
  }
  for (const [r, t] of [
    [1, 'Mon'],
    [3, 'Wed'],
    [5, 'Fri'],
  ])
    labels.push(`<text x="${gridX - 9}" y="${cy(r) + 3.5}" text-anchor="end">${t}</text>`);
  body.push(`<g class="m" font-size="9.5" fill="#6f8498">${labels.join('')}</g>`);

  // ----- cells -----
  body.push(
    `<g>${cells.map((c) => `<use href="#e" x="${gx(c.col)}" y="${gy(c.row)}"/>`).join('')}</g>`,
  );

  const eatTime = new Map(eats.map((e) => [e.cell, e.step * dt]));
  const cellRects = [];
  const fx = [];
  active.forEach((c, i) => {
    const glow = c.level >= 3 ? ' filter="url(#cg)"' : '';
    const cls = animated ? ` class="c" style="animation-name:c${i}"` : '';
    cellRects.push(`<rect${cls} x="${gx(c.col)}" y="${gy(c.row)}" width="${CELL}" height="${CELL}" rx="2.6" fill="${LEVEL_FILL[c.level]}"${glow}/>`);
    if (!animated) return;
    const te = eatTime.get(c);
    const rs = waveStart + c.col * 0.022;
    const base = LEVEL_FILL[c.level];
    css.push(
      tl.keyframes(`c${i}`, [
        ['0%', `transform:scale(1);fill:${base}`],
        [te - 0.05, `transform:scale(1);fill:${base}`],
        [te + 0.08, 'transform:scale(1.45);fill:#dafff8'],
        [te + 0.3, `transform:scale(0);fill:${base}`],
        [rs, 'transform:scale(0)'],
        [rs + 0.26, 'transform:scale(1.18)'],
        [rs + 0.42, 'transform:scale(1)'],
        ['100%', 'transform:scale(1)'],
      ]),
    );
    const d = `animation-delay:${r2(te - 0.02)}s`;
    fx.push(
      `<circle class="rg" style="${d}" cx="${cx(c.col)}" cy="${cy(c.row)}" r="${CELL / 2}" stroke="${LEVEL_FILL[Math.max(3, c.level)]}" stroke-width="1.2"/>` +
        `<g transform="translate(${cx(c.col)},${cy(c.row)})"><use href="#k" class="sp" style="${d}"/></g>`,
    );
  });
  body.push(`<g>${cellRects.join('')}</g>`);

  // ----- snake -----
  const snake = [];
  if (animated) {
    // translate keyframes: only the corners are needed because motion between them is linear
    const mvStops = [];
    for (let i = 0; i <= steps; i++) {
      const corner = i === 0 || i === steps || dirAt(i) !== dirAt(i + 1);
      if (corner) mvStops.push([i * dt, `transform:${tr(path[i])}`]);
    }
    mvStops.push(['100%', `transform:${tr(path[steps])}`]);
    css.push(tl.keyframes('mv', mvStops));

    // head heading: rotate through each corner over ~half a step
    const rotStops = [['0%', 'transform:rotate(0deg)']];
    let angle = 0;
    for (let i = 1; i < steps; i++) {
      const a = dirAt(i);
      const b = dirAt(i + 1);
      if (a === b) continue;
      let delta = b - a;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      rotStops.push([(i - 0.28) * dt, `transform:rotate(${angle}deg)`]);
      angle += delta;
      rotStops.push([(i + 0.28) * dt, `transform:rotate(${angle}deg)`]);
    }
    rotStops.push(['100%', `transform:rotate(${angle}deg)`]);
    css.push(tl.keyframes('hr', rotStops));

    // chomp pulse on each bite (merged when bites are back-to-back)
    const chomp = [['0%', 'transform:scale(1)']];
    let lastBite = -9;
    for (const e of eats) {
      const t = e.step * dt;
      if (t - lastBite < 0.34) continue;
      lastBite = t;
      chomp.push([t - 0.1, 'transform:scale(1)'], [t + 0.05, 'transform:scale(1.22)'], [t + 0.24, 'transform:scale(1)']);
    }
    chomp.push(['100%', 'transform:scale(1)']);
    css.push(tl.keyframes('hp', chomp));

    // progress bar + body growth both follow the eaten count
    let cum = 0;
    const pb = [['0%', 'transform:scaleX(0)']];
    const grownAt = new Map(); // segment index -> time it appears
    eats.forEach((e, n) => {
      cum += e.cell.count;
      const t = e.step * dt;
      pb.push([t, `transform:scaleX(${r2(cum / Math.max(1, total))})`]);
      const segs = Math.round(MIN_SEGS + ((MAX_SEGS - MIN_SEGS) * (n + 1)) / eats.length);
      for (let j = MIN_SEGS + 1; j <= segs; j++) if (!grownAt.has(j)) grownAt.set(j, t);
    });
    pb.push([waveStart, 'transform:scaleX(1)'], [L - 0.4, 'transform:scaleX(0)'], ['100%', 'transform:scaleX(0)']);
    css.push(tl.keyframes('pg', pb));

    snake.push(`<g class="sg"><circle r="24" fill="url(#aura)"/></g>`);
    for (let j = MAX_SEGS; j >= 1; j--) {
      const seg = `<g class="sg" style="animation-delay:${r2(j * SEG_LAG * dt)}s"><g class="br" style="animation-delay:-${r2(j * 0.09)}s">${segmentShape(j)}</g></g>`;
      if (j > MIN_SEGS) {
        const t = grownAt.get(j) ?? runT;
        css.push(tl.keyframes(`v${j}`, [['0%', 'opacity:0'], [t, 'opacity:0'], [t + 0.25, 'opacity:1'], ['100%', 'opacity:1']]));
        snake.push(`<g style="animation:v${j} ${L}s linear infinite">${seg}</g>`);
      } else snake.push(seg);
    }
    snake.push(`<g class="sg"><g class="hr"><g class="hp">${headShape(true)}</g></g></g>`);
  }

  // static pose (reduced motion + fallback image): rest the snake where it covers the fewest active cells
  const activeKey = new Set(active.map((c) => c.col * 8 + c.row));
  let bestH = null;
  let bestScore = Infinity;
  for (let h = Math.ceil(STILL_SEGS * SEG_LAG) + 4; h < steps - 4; h++) {
    let score = 0;
    let inside = true;
    for (let j = 0; j <= STILL_SEGS; j++) {
      const [c, r] = posAt(h - j * SEG_LAG);
      if (c < 0 || c > cols - 1) inside = false;
      if (activeKey.has(Math.round(c) * 8 + Math.round(r))) score++;
    }
    const [hc] = posAt(h);
    score += Math.abs(hc - cols * 0.62) * 0.02; // prefer a calm spot right of centre
    if (inside && score < bestScore) {
      bestScore = score;
      bestH = h;
    }
  }
  const still = [];
  if (bestH !== null) {
    for (let j = STILL_SEGS; j >= 1; j--) {
      const [c, r] = posAt(bestH - j * SEG_LAG);
      still.push(`<g transform="translate(${r2(cx(c))},${r2(cy(r))})">${segmentShape(j)}</g>`);
    }
    const [hc, hr] = posAt(bestH);
    still.push(`<g transform="translate(${r2(cx(hc))},${r2(cy(hr))}) rotate(${dirAt(bestH)})">${headShape(false)}</g>`);
  }

  body.push(
    `<g clip-path="url(#gc)">` +
      (animated ? `<g class="fx">${fx.join('')}</g><g class="snk" filter="url(#sg)">${snake.join('')}</g>` : '') +
      `<g class="still" filter="url(#sg)">${still.join('')}</g>` +
      `</g>`,
  );

  // ----- footer: range + legend -----
  const fy = GRID_Y + gridH + 27;
  const legendX = ARENA.x + ARENA.w - 20;
  const sq = LEVEL_FILL.map(
    (f, i) => `<rect x="${legendX - 30 - (5 - i) * 15}" y="${fy - 9}" width="${CELL}" height="${CELL}" rx="2.6" fill="${f}"${i === 0 ? ' stroke="#1b2a39" stroke-width=".6"' : ''}${i >= 3 ? ' filter="url(#cg)"' : ''}/>`,
  );
  body.push(
    `<g class="m" font-size="10.5" fill="#6f8498">` +
      `<text x="${gridX}" y="${fy}">${fmtDate(first)} — ${fmtDate(last)}</text>` +
      `<text x="${legendX - 30 - 5 * 15 - 7}" y="${fy}" text-anchor="end">Less</text>${sq.join('')}<text x="${legendX}" y="${fy}" text-anchor="end">More</text></g>`,
  );

  // ----- styles -----
  if (animated) {
    css.push(
      `.c{transform-box:fill-box;transform-origin:center;animation:${L}s linear infinite both}`,
      `.sg{animation:mv ${L}s linear infinite both}`,
      `.hr{animation:hr ${L}s linear infinite both}`,
      `.hp{animation:hp ${L}s linear infinite both}`,
      `.pb{transform-box:fill-box;transform-origin:left;animation:pg ${L}s linear infinite both}`,
      `.rg,.sp{opacity:0;transform-box:fill-box;transform-origin:center}`,
      `.rg{animation:rg ${L}s linear infinite}`,
      `.sp{animation:sp ${L}s linear infinite}`,
      tl.keyframes('rg', [['0%', 'opacity:.95;transform:scale(.55)'], [0.5, 'opacity:0;transform:scale(2.7)'], ['100%', 'opacity:0;transform:scale(2.7)']]),
      tl.keyframes('sp', [['0%', 'opacity:1;transform:scale(.4) rotate(0deg)'], [0.42, 'opacity:0;transform:scale(1.9) rotate(45deg)'], ['100%', 'opacity:0;transform:scale(1.9) rotate(45deg)']]),
      `.br{animation:br 1.5s ease-in-out infinite alternate}@keyframes br{to{transform:scale(1.08)}}`,
      `.hb{animation:hb 1.1s ease-in-out infinite alternate}@keyframes hb{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}`,
      `.bl{animation:bl 4.6s infinite}@keyframes bl{0%,93%,100%{transform:scaleY(1)}95.5%{transform:scaleY(.12)}}`,
      `.tg{animation:tg 1.9s ease-in-out infinite}@keyframes tg{0%,55%,100%{transform:scaleX(0)}64%{transform:scaleX(1)}71%{transform:scaleX(.6)}78%{transform:scaleX(1)}86%{transform:scaleX(0)}}`,
      `.live{animation:live 1.8s ease-in-out infinite}@keyframes live{50%{opacity:.35}}`,
      `.still{display:none}`,
      `@media (prefers-reduced-motion:reduce){*{animation:none!important}.snk,.fx{display:none}.still{display:inline}.pb{opacity:0}}`,
    );
  }

  const title = `04 / GitHub activity — contribution snake for ${login}`;
  const desc =
    `GitHub contribution calendar from ${fmtDate(first)} to ${fmtDate(last)}: ${fmtInt(total)} contributions across ${active.length} active days. ` +
    (animated ? 'An animated snake travels the calendar grid and eats each day that has contributions, then the calendar regrows and the loop repeats.' : 'A snake rests on the calendar.');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d" fill="none">\n` +
    `<title id="t">${esc(title)}</title>\n<desc id="d">${esc(desc)}</desc>\n` +
    `<style>${css.join('\n')}</style>\n` +
    `<defs>${defs.join('')}</defs>\n` +
    body.join('\n') +
    `\n</svg>\n`
  );
}
