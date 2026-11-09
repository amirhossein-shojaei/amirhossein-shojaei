// Shared design tokens and SVG helpers for the profile README cards.
// Mirrors the visual language of the hand-built cards in /assets.

export const FONT_STYLE =
  ".s{font-family:Inter,'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif}" +
  ".m{font-family:'JetBrains Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace}";

export const C = {
  panelStroke: '#263647',
  inner: '#2a4055',
  teal: '#5ee6cf',
  heading: '#9ecbff',
  title: '#e9f3ff',
  body: '#aebdcb',
  muted: '#91a4b8',
  faint: '#6f8498',
  pillBg: '#0f2537',
  pillStroke: '#28506e',
  pillText: '#cfe6f5',
};

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const r1 = (n) => Math.round(n * 10) / 10;
export const r2 = (n) => Math.round(n * 100) / 100;

/** Width of monospaced text in the existing cards (0.6em glyph + letter-spacing). */
export const monoWidth = (text, size, spacing = 0) => text.length * (size * 0.6 + spacing);

// Approximate advance widths (em) for a Helvetica/Segoe-like sans, used only for line wrapping.
const NARROW = new Set([...'ijlI|.,:;!\'`']);
const SEMI = new Set([...'frt()[]{}-/ "']);
const WIDE = new Set([...'mwMW@%']);
export function sansWidth(text, size) {
  let em = 0;
  for (const ch of text) {
    if (NARROW.has(ch)) em += 0.26;
    else if (SEMI.has(ch)) em += 0.36;
    else if (WIDE.has(ch)) em += 0.86;
    else if (ch >= 'A' && ch <= 'Z') em += 0.66;
    else if (ch >= '0' && ch <= '9') em += 0.56;
    else em += 0.53;
  }
  return em * size;
}

/** Greedy word wrap using the sans width estimate. */
export function wrap(text, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (sansWidth(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Numbered section heading identical to the other cards ("04 / GITHUB ACTIVITY"). */
export function sectionHeading(index, label, width = 900) {
  const full = `${index} / ${label}`;
  const len = r1(monoWidth(full, 17, 0.6));
  const lineX = r1(40 + len + 14);
  return (
    `<text class="m" x="40" y="50" font-size="17" font-weight="600" letter-spacing="0.6" textLength="${len}" lengthAdjust="spacingAndGlyphs">` +
    `<tspan fill="${C.teal}">${esc(index)}</tspan><tspan fill="${C.heading}"> / ${esc(label)}</tspan></text>\n` +
    `<rect x="${lineX}" y="44" width="${r1(width - 40 - lineX)}" height="1" fill="url(#hl)"/>`
  );
}

export const PANEL_DEFS =
  '<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111a25"/><stop offset="1" stop-color="#0f1721"/></linearGradient>' +
  '<linearGradient id="hl" x1="0" x2="1"><stop stop-color="#315678"/><stop offset="1" stop-color="#315678" stop-opacity="0"/></linearGradient>';

export const panel = (w, h) =>
  `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="url(#pg)" stroke="${C.panelStroke}"/>`;

export const fmtInt = (n) => Number(n).toLocaleString('en-US');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthName = (i) => MONTHS[i];
export function fmtDate(iso, withYear = true) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${withYear ? ', ' + d.getUTCFullYear() : ''}`;
}
