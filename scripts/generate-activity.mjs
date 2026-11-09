#!/usr/bin/env node
// Generates the GitHub activity assets for the profile README from real contribution data.
//
//   node scripts/generate-activity.mjs [--user <login>] [--out <dir>]
//
// Env: GITHUB_TOKEN (optional locally, provided by GitHub Actions). Without it the script
// reads the public contribution calendar; commit totals and languages are then omitted.
//
// Outputs (in --out, default ./dist):
//   contribution-snake.svg         animated calendar + snake (CSS keyframes, no JS)
//   contribution-snake-static.svg  static fallback (no animation)
//   github-stats.svg               totals, streaks, commits, languages
//   activity.json                  the numbers used, for debugging

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { getContributionData } from './lib/github-data.mjs';
import { renderSnake } from './lib/snake.mjs';
import { renderStats } from './lib/stats.mjs';

const { values: args } = parseArgs({
  options: {
    user: { type: 'string', default: process.env.GITHUB_USER || 'amirhossein-shojaei' },
    out: { type: 'string', default: 'dist' },
  },
});

function assertSvg(name, svg) {
  if (!svg.startsWith('<svg') || !svg.trimEnd().endsWith('</svg>')) throw new Error(`${name}: malformed SVG output`);
  if (/undefined|NaN/.test(svg)) throw new Error(`${name}: contains undefined/NaN values`);
  if (svg.length > 900_000) throw new Error(`${name}: unexpectedly large (${svg.length} bytes)`);
}

async function main() {
  const login = args.user;
  const data = await getContributionData(login, process.env.GITHUB_TOKEN);
  if (!data.days.length) throw new Error('no contribution days returned');

  const files = {
    'contribution-snake.svg': renderSnake(data, { animated: true, login }),
    'contribution-snake-static.svg': renderSnake(data, { animated: false, login }),
    'github-stats.svg': renderStats(data, { login }),
  };
  await mkdir(args.out, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    assertSvg(name, svg);
    await writeFile(join(args.out, name), svg);
  }
  const summary = {
    user: login,
    source: data.source,
    range: [data.days[0].date, data.today],
    lastYearTotal: data.lastYearTotal,
    activeDaysLastYear: data.days.filter((d) => d.count > 0).length,
    totalAllTime: data.totalAllTime,
    totalCommits: data.totalCommits,
    streaks: data.streaks,
    languages: data.languages?.slice(0, 8) ?? null,
  };
  await writeFile(join(args.out, 'activity.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const [name, svg] of Object.entries(files)) console.log(`wrote ${name} (${(svg.length / 1024).toFixed(1)} KB)`);
  console.log(JSON.stringify({ ...summary, languages: summary.languages?.map((l) => l.name) }, null, 2));
}

main().catch((err) => {
  console.error(`::error::Activity generation failed: ${err.message}`);
  process.exit(1);
});
