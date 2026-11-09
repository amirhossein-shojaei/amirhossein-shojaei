// Secondary statistics card: totals, streaks, commits and most-used languages.
// Values that the data source could not provide are shown as "—" with a note, never estimated.

import { FONT_STYLE, C, esc, r1, fmtInt, fmtDate, monoWidth, PANEL_DEFS, panel } from './svg-kit.mjs';

const W = 900;
const ICONS = {
  total: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  current: '<path d="M12 3c1 3.5 5 5.2 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.4-4.8.3 1.6 1.1 2.6 2.1 2.8C11 8.6 11 5.6 12 3Z"/>',
  longest: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.7M17 6h2.5a2.5 2.5 0 0 1-2.6 3.7"/>',
  commits: '<circle cx="12" cy="12" r="3.2"/><path d="M3 12h5.8M15.2 12H21"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
};

const range = (s) => (s.start ? (s.start === s.end ? fmtDate(s.start) : `${fmtDate(s.start, false)} – ${fmtDate(s.end)}`) : 'No active streak');

export function renderStats(data, { login } = {}) {
  const { streaks } = data;
  const tiles = [
    { icon: 'total', label: 'TOTAL CONTRIBUTIONS', value: fmtInt(data.totalAllTime), sub: `All time · since ${data.firstYear}`, accent: '#5ee6cf' },
    { icon: 'current', label: 'CURRENT STREAK', value: `${streaks.current.length}`, unit: streaks.current.length === 1 ? 'day' : 'days', sub: range(streaks.current), accent: '#42d6a4' },
    { icon: 'longest', label: 'LONGEST STREAK', value: `${streaks.longest.length}`, unit: streaks.longest.length === 1 ? 'day' : 'days', sub: range(streaks.longest), accent: '#39d0d8' },
    {
      icon: 'commits',
      label: 'TOTAL COMMITS',
      value: data.totalCommits == null ? '—' : fmtInt(data.totalCommits),
      sub: data.totalCommits == null ? 'Needs GitHub API token' : `All time · since ${data.firstYear}`,
      accent: '#79c0ff',
    },
  ];

  const tileW = 196;
  const gap = (820 - tileW * 4) / 3;
  const ty = 72;
  const tileH = 98;
  const out = [];

  tiles.forEach((t, i) => {
    const x = 40 + i * (tileW + gap);
    out.push(
      `<rect x="${r1(x)}" y="${ty}" width="${tileW}" height="${tileH}" rx="12" fill="#0f1b28" stroke="#22374a"/>`,
      `<rect x="${r1(x + 16)}" y="${ty}" width="${tileW - 32}" height="1.5" fill="${t.accent}" opacity=".55"/>`,
      `<g transform="translate(${r1(x + 16)},${ty + 16}) scale(.66)" stroke="${t.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[t.icon]}</g>`,
      `<text class="m" x="${r1(x + 38)}" y="${ty + 28}" font-size="9.5" font-weight="600" letter-spacing=".9" fill="#8fa6ba">${t.label}</text>`,
      `<text class="s" x="${r1(x + 16)}" y="${ty + 64}" font-size="27" font-weight="700" letter-spacing="-.5" fill="${C.title}">${esc(t.value)}` +
        (t.unit ? `<tspan dx="6" font-size="13" font-weight="500" letter-spacing="0" fill="${C.muted}">${t.unit}</tspan>` : '') +
        `</text>`,
      `<text class="s" x="${r1(x + 16)}" y="${ty + 84}" font-size="11.5" fill="${C.faint}">${esc(t.sub)}</text>`,
    );
  });

  // languages
  const ly = ty + tileH + 22;
  const langs = data.languages;
  const lx = 40;
  out.push(
    `<rect x="${lx}" y="${ly}" width="820" height="${langs ? 92 : 70}" rx="12" fill="#0f1b28" stroke="#22374a"/>`,
    `<g transform="translate(${lx + 16},${ly + 16}) scale(.66)" stroke="#a5a0ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.code}</g>`,
    `<text class="m" x="${lx + 38}" y="${ly + 28}" font-size="9.5" font-weight="600" letter-spacing=".9" fill="#8fa6ba">MOST USED LANGUAGES</text>`,
    `<text class="s" x="${lx + 804}" y="${ly + 28}" font-size="11" fill="${C.faint}" text-anchor="end">${langs ? 'Weighted by commit activity across repositories' : ''}</text>`,
  );
  let H;
  if (langs) {
    const top = langs.slice(0, 6);
    const rest = 1 - top.reduce((s, l) => s + l.share, 0);
    if (rest > 0.005) top.push({ name: 'Other', color: '#3a4a5c', share: rest });
    const barX = lx + 16;
    const barW = 788;
    let x = barX;
    const segs = top.map((l, i) => {
      const w = i === top.length - 1 ? barX + barW - x : Math.max(2, l.share * barW);
      const s = `<rect x="${r1(x)}" y="${ly + 42}" width="${r1(Math.max(0, w - 2))}" height="8" fill="${l.color}"/>`;
      x += w;
      return s;
    });
    out.push(
      `<clipPath id="lb"><rect x="${barX}" y="${ly + 42}" width="${barW}" height="8" rx="4"/></clipPath>`,
      `<g clip-path="url(#lb)">${segs.join('')}</g>`,
    );
    let kx = barX;
    for (const l of top) {
      const label = `${l.name} ${(l.share * 100).toFixed(1)}%`;
      out.push(
        `<circle cx="${r1(kx + 4)}" cy="${ly + 70}" r="4" fill="${l.color}"/>`,
        `<text class="s" x="${r1(kx + 13)}" y="${ly + 74}" font-size="12" fill="#c3d2e0">${esc(l.name)} <tspan class="m" font-size="11" fill="${C.faint}">${(l.share * 100).toFixed(1)}%</tspan></text>`,
      );
      kx += 13 + label.length * 7.1 + 18;
    }
    H = ly + 92 + 24;
  } else {
    out.push(`<text class="s" x="${lx + 16}" y="${ly + 52}" font-size="12.5" fill="${C.faint}">Language breakdown is generated by the GitHub Actions workflow (requires the GitHub GraphQL API).</text>`);
    H = ly + 70 + 24;
  }

  const head = 'GITHUB STATS';
  const hw = r1(monoWidth(head, 13, 0.8));
  const updated = `Updated ${fmtDate(data.today)}`;
  const header =
    `<path d="M44 37.5 47.5 34l3.5 3.5-3.5 3.5Z" fill="#5ee6cf"/>` +
    `<text class="m" x="58" y="42" font-size="13" font-weight="600" letter-spacing=".8" fill="${C.heading}">${head}</text>` +
    `<rect x="${r1(58 + hw + 14)}" y="37" width="${r1(860 - 58 - hw - 14 - 140)}" height="1" fill="url(#hl)"/>` +
    `<text class="m" x="860" y="42" font-size="10.5" fill="${C.faint}" text-anchor="end">${esc(updated)}</text>`;

  const desc =
    `GitHub statistics for ${login}: ${tiles.map((t) => `${t.label.toLowerCase()} ${t.value}${t.unit ? ' ' + t.unit : ''}`).join(', ')}` +
    (langs ? `. Most used languages: ${langs.slice(0, 5).map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`).join(', ')}.` : '.');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d" fill="none">\n` +
    `<title id="t">GitHub stats</title>\n<desc id="d">${esc(desc)}</desc>\n` +
    `<style>${FONT_STYLE}</style>\n<defs>${PANEL_DEFS}</defs>\n` +
    panel(W, H) +
    '\n' +
    header +
    '\n' +
    out.join('\n') +
    `\n</svg>\n`
  );
}
