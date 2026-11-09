#!/usr/bin/env node
// Builds assets/projects.svg ("03 / Selected projects") from the data below.
//   node scripts/build-projects.mjs
// Edit PROJECTS and re-run; the layout (wrapping, card heights, pills) is computed.

import { writeFile } from 'node:fs/promises';
import { FONT_STYLE, C, esc, r1, wrap, monoWidth, sectionHeading, PANEL_DEFS } from './lib/svg-kit.mjs';

const PROJECTS = [
  {
    name: 'Hobo',
    category: 'SHOPIFY APP · AI',
    tagline: 'AI shopping assistant & customer support for Shopify',
    accent: '#5ee6cf',
    icon: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
    description:
      "An embedded Shopify app that adds an AI chat assistant to the storefront, answering shoppers from the store's own catalog and content and handing the conversation to a human agent when needed.",
    features: [
      'Agentic AI chat with streamed responses',
      'Semantic product & content search (RAG)',
      'Human handoff for support conversations',
      'Real-time catalog sync via Shopify webhooks',
    ],
    stack: ['TypeScript', 'React', 'Next.js', 'Node.js', 'Express', 'MongoDB', 'Qdrant', 'OpenAI API'],
  },
  {
    name: 'Coup',
    category: 'RESERVATION PWA',
    tagline: 'Coworking space management & booking',
    accent: '#79c0ff',
    icon: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="m9 15 2 2 4-4"/>',
    description:
      'A full-stack Progressive Web App for managing and reserving coworking space at Pardis Technology Park. Members browse available spaces, pick a seat or meeting room, and book it online from mobile or desktop.',
    features: ['Online seat reservation', 'Meeting room booking', 'Coworking space management', 'Installable, responsive PWA'],
    stack: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Express', 'PWA', 'Docker'],
  },
  {
    name: 'OIEC',
    category: 'ENTERPRISE · AI',
    tagline: 'Product data processing & legacy code conversion',
    accent: '#f2c46d',
    icon: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/><path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    description:
      'An enterprise full-stack app for processing product information and converting legacy product codes to a new structure, with Flowise AI pipelines automating part of a review-heavy workflow.',
    features: ['Product information management', 'Legacy product code conversion', 'AI-assisted processing with Flowise', 'Dockerized server deployment'],
    stack: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Express', 'Flowise', 'Docker'],
  },
  {
    name: 'INOTEX',
    category: 'EVENT PWA · AI',
    tagline: 'Digital exhibition & networking platform',
    accent: '#a5a0ff',
    icon: '<path d="M3 8.5V6a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6v2.5a2.5 2.5 0 0 0 0 5V16a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16v-2.5a2.5 2.5 0 0 0 0-5Z"/><path d="M14.5 7v1.5M14.5 11.25v1.5M14.5 15.5V17"/>',
    description:
      'A Progressive Web App that brings the exhibitors, companies, event programs and news of the INOTEX exhibition into one place, with an AI chatbot that answers visitor questions.',
    features: ['Exhibitor & company directory', 'Event programs and news', 'AI chatbot for visitor questions', 'Installable, responsive PWA'],
    stack: ['React', 'TypeScript', 'Tailwind CSS', 'Node.js', 'Express', 'MongoDB', 'Flowise', 'Docker'],
  },
  {
    name: 'Elixia',
    category: 'AI · FITNESS PWA',
    tagline: 'AI-powered workout & nutrition planning',
    accent: '#56d364',
    icon: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    description:
      "A fitness Progressive Web App that uses AI to recommend personalized workout and nutrition plans based on each user's information and goals, delivered as an installable, app-like experience for daily use.",
    features: ['AI workout plan recommendations', 'Nutrition plan recommendations', 'Personalized to user goals', 'Installable mobile PWA'],
    stack: ['React', 'TypeScript', 'Tailwind CSS', 'PWA', 'AI Integration'],
  },
];

const W = 900;
const CARD_X = 40;
const CARD_W = 820;
const PAD = 26;
const TEXT_W = CARD_W - PAD * 2;

function card(p, y, i) {
  const out = [];
  const x = CARD_X;
  const ix = x + 24;
  const g = `g${i}`;
  out.push(`<linearGradient id="${g}" x1="0" x2="1"><stop stop-color="${p.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${p.accent}" stop-opacity=".7"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></linearGradient>`);
  const body = [];
  // header: icon, name, tagline, category pill
  body.push(
    `<rect x="${ix}" y="${y + 24}" width="54" height="54" rx="14" fill="url(#ig)" stroke="#2f5375"/>`,
    `<g transform="translate(${r1(ix + 13.2)},${r1(y + 37.2)}) scale(1.15)" stroke="${p.accent}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p.icon}</g>`,
    `<text class="s" x="${ix + 72}" y="${y + 52}" font-size="25" font-weight="700" letter-spacing="-.4" fill="${C.title}">${esc(p.name)}</text>`,
    `<text class="m" x="${ix + 73}" y="${y + 75}" font-size="12.5" font-weight="500" fill="${p.accent}">${esc(p.tagline)}</text>`,
  );
  const catW = r1(monoWidth(p.category, 10.5, 1) + 34);
  const catX = r1(x + CARD_W - 24 - catW);
  body.push(
    `<rect x="${catX}" y="${y + 26}" width="${catW}" height="24" rx="12" fill="#0d1b28" stroke="#2c4256"/>`,
    `<circle cx="${r1(catX + 12)}" cy="${y + 38}" r="2.6" fill="${p.accent}"/>`,
    `<text class="m" x="${r1(catX + 22)}" y="${y + 42}" font-size="10.5" font-weight="600" letter-spacing="1" fill="#8fb3cc">${esc(p.category)}</text>`,
  );
  // description
  let cy = y + 114;
  for (const line of wrap(p.description, 15.5, TEXT_W)) {
    body.push(`<text class="s" x="${x + PAD}" y="${cy}" font-size="15.5" fill="${C.body}">${esc(line)}</text>`);
    cy += 24;
  }
  // features (two columns)
  cy += 8;
  const colW = TEXT_W / 2;
  p.features.forEach((f, k) => {
    const fx = x + PAD + (k % 2) * colW;
    const fy = cy + Math.floor(k / 2) * 26;
    body.push(
      `<circle cx="${r1(fx + 5)}" cy="${fy - 5}" r="3.6" stroke="${p.accent}" stroke-width="1.6"/>`,
      `<text class="s" x="${r1(fx + 16)}" y="${fy}" font-size="14" fill="#c3d2e0">${esc(f)}</text>`,
    );
  });
  cy += Math.ceil(p.features.length / 2) * 26 - 4;
  body.push(`<line x1="${x + PAD}" x2="${x + CARD_W - PAD}" y1="${cy}" y2="${cy}" stroke="#2a3f53" stroke-dasharray="4 4"/>`);
  // stack pills (wrap onto extra rows if needed)
  let py = cy + 14;
  body.push(`<text class="m" x="${x + PAD}" y="${py + 17}" font-size="10.5" font-weight="600" letter-spacing="1.2" fill="#6f899f">STACK</text>`);
  const startX = x + PAD + 54;
  let px = startX;
  for (const s of p.stack) {
    const w = r1(monoWidth(s, 12) + 20);
    if (px + w > x + CARD_W - PAD) {
      px = startX;
      py += 34;
    }
    body.push(
      `<rect x="${r1(px)}" y="${py}" width="${w}" height="26" rx="6" fill="${C.pillBg}" stroke="${C.pillStroke}"/>`,
      `<text class="m" x="${r1(px + 10)}" y="${py + 17.5}" font-size="12" font-weight="500" fill="${C.pillText}">${esc(s)}</text>`,
    );
    px += w + 8;
  }
  const bottom = py + 26 + 24;
  const h = bottom - y;
  const shell = [
    `<rect x="${x}" y="${y}" width="${CARD_W}" height="${h}" rx="13" fill="url(#cg)" stroke="#2a4055"/>`,
    `<rect x="${x + 20}" y="${y}" width="${CARD_W - 40}" height="2" fill="url(#${g})"/>`,
  ];
  return { defs: out, body: [...shell, ...body], bottom };
}

function build() {
  const defs = [
    PANEL_DEFS,
    '<linearGradient id="cg" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#122131"/><stop offset=".7" stop-color="#0e1925"/></linearGradient>',
    '<linearGradient id="ig" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#173149"/><stop offset="1" stop-color="#0f2133"/></linearGradient>',
  ];
  const body = [sectionHeading('03', 'SELECTED PROJECTS')];
  let y = 80;
  PROJECTS.forEach((p, i) => {
    const c = card(p, y, i);
    defs.push(...c.defs);
    body.push(...c.body);
    y = c.bottom + 20;
  });
  const H = y - 20 + 40;
  const desc = PROJECTS.map(
    (p) => `${p.name} (${p.category}): ${p.description} Key features: ${p.features.join('; ')}. Stack: ${p.stack.join(', ')}.`,
  ).join(' ');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d" fill="none">\n` +
    `<title id="t">03 / Selected projects</title>\n<desc id="d">${esc(desc)}</desc>\n` +
    `<style>${FONT_STYLE}</style>\n<defs>${defs.join('\n')}</defs>\n` +
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="url(#pg)" stroke="${C.panelStroke}"/>\n` +
    body.join('\n') +
    `\n</svg>\n`
  );
}

const svg = build();
await writeFile(new URL('../assets/projects.svg', import.meta.url), svg);
console.log(`wrote assets/projects.svg (${(svg.length / 1024).toFixed(1)} KB)`);
