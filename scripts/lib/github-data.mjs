// Retrieves real contribution data for a GitHub user.
//
// Primary source: the GitHub GraphQL API (needs a token — the Actions GITHUB_TOKEN is enough).
// Fallback: the public contribution-calendar HTML that github.com serves for every profile
// (no token; used for local previews or if GraphQL is unavailable). Commit totals and
// languages are only available from GraphQL and are reported as `null` otherwise — never guessed.

const UA = 'profile-activity-generator';
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(label, fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const wait = 1500 * 2 ** i;
        console.warn(`[data] ${label} failed (${err.message}); retrying in ${wait} ms`);
        await sleep(wait);
      }
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastErr.message}`);
}

async function graphql(token, query, variables) {
  return withRetry('GraphQL request', async () => {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
    return json.data;
  });
}

const LANG_FIELDS = 'languages(first: 10, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name color } } }';

const Q_MAIN = `query($login: String!) {
  user(login: $login) {
    createdAt
    contributionsCollection {
      contributionYears
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel weekday } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
      nodes { nameWithOwner ${LANG_FIELDS} }
    }
  }
}`;

function yearsQuery(years, now) {
  const parts = years.map((y) => {
    const to = y === now.getUTCFullYear() ? now.toISOString() : `${y}-12-31T23:59:59Z`;
    return `y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${to}") {
      totalCommitContributions
      contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      commitContributionsByRepository(maxRepositories: 100) {
        contributions { totalCount }
        repository { nameWithOwner isFork ${LANG_FIELDS} }
      }
    }`;
  });
  return `query($login: String!) { user(login: $login) { ${parts.join('\n')} } }`;
}

/** Languages weighted by commit activity: each repo's language byte-share × commits made to it. */
function computeLanguages(ownedRepos, commitRepos) {
  const weights = new Map(); // nameWithOwner -> { commits, langs }
  for (const { repository: r, contributions } of commitRepos) {
    if (!r || r.isFork) continue;
    const cur = weights.get(r.nameWithOwner) || { commits: 0, langs: r.languages.edges };
    cur.commits += contributions.totalCount;
    weights.set(r.nameWithOwner, cur);
  }
  for (const r of ownedRepos) {
    if (!weights.has(r.nameWithOwner)) weights.set(r.nameWithOwner, { commits: 1, langs: r.languages.edges });
  }
  const score = new Map();
  for (const { commits, langs } of weights.values()) {
    const total = langs.reduce((s, e) => s + e.size, 0);
    if (!total) continue;
    for (const e of langs) {
      const cur = score.get(e.node.name) || { name: e.node.name, color: e.node.color || '#8b949e', value: 0 };
      cur.value += (e.size / total) * commits;
      score.set(e.node.name, cur);
    }
  }
  const sum = [...score.values()].reduce((s, l) => s + l.value, 0);
  if (!sum) return null;
  return [...score.values()]
    .map((l) => ({ name: l.name, color: l.color, share: l.value / sum }))
    .sort((a, b) => b.share - a.share);
}

async function fromGraphQL(login, token) {
  const now = new Date();
  const main = (await graphql(token, Q_MAIN, { login })).user;
  if (!main) throw new Error(`user "${login}" not found`);
  const cal = main.contributionsCollection.contributionCalendar;
  const days = cal.weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LEVELS[d.contributionLevel] ?? 0 })),
  );

  const years = main.contributionsCollection.contributionYears;
  const perYear = years.length ? (await graphql(token, yearsQuery(years, now), { login })).user : {};
  const history = new Map();
  let totalAllTime = 0;
  let totalCommits = 0;
  const commitRepos = [];
  for (const y of years) {
    const c = perYear[`y${y}`];
    totalAllTime += c.contributionCalendar.totalContributions;
    totalCommits += c.totalCommitContributions;
    commitRepos.push(...c.commitContributionsByRepository);
    for (const w of c.contributionCalendar.weeks) for (const d of w.contributionDays) history.set(d.date, d.contributionCount);
  }
  for (const d of days) history.set(d.date, d.count);

  return {
    source: 'graphql',
    days,
    lastYearTotal: cal.totalContributions,
    totalAllTime,
    totalCommits,
    history,
    firstYear: years.length ? Math.min(...years) : now.getUTCFullYear(),
    languages: computeLanguages(main.repositories.nodes, commitRepos),
  };
}

// ---------- Public HTML fallback ----------

async function fetchText(url) {
  return withRetry(`GET ${url}`, async () => {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  });
}

function parseCalendarHtml(html) {
  const counts = new Map();
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = /^\s*([\d,]+)\s+contribution/.exec(m[2]);
    counts.set(m[1], n ? Number(n[1].replace(/,/g, '')) : 0);
  }
  const days = [];
  for (const m of html.matchAll(/<td\b[^>]*class="ContributionCalendar-day"[^>]*>/g)) {
    const tag = m[0];
    const date = /data-date="([\d-]+)"/.exec(tag)?.[1];
    const level = Number(/data-level="(\d)"/.exec(tag)?.[1] ?? 0);
    const id = /\bid="([^"]+)"/.exec(tag)?.[1];
    if (!date) continue;
    let count = counts.get(id);
    if (count === undefined) count = level > 0 ? 1 : 0; // tooltip missing: at least one contribution
    days.push({ date, count, level });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!days.length) throw new Error('no calendar cells found in contribution HTML');
  return days;
}

async function fromPublicHtml(login) {
  const base = `https://github.com/users/${encodeURIComponent(login)}/contributions`;
  const days = parseCalendarHtml(await fetchText(base));
  let firstYear = Number(days[0].date.slice(0, 4));
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`, { headers: { 'User-Agent': UA } });
    if (res.ok) firstYear = Number((await res.json()).created_at.slice(0, 4));
  } catch {
    /* keep the calendar's first year */
  }
  const history = new Map();
  const thisYear = new Date().getUTCFullYear();
  for (let y = firstYear; y <= thisYear; y++) {
    for (const d of parseCalendarHtml(await fetchText(`${base}?from=${y}-01-01&to=${y}-12-31`))) {
      if (d.date.startsWith(String(y))) history.set(d.date, d.count);
    }
  }
  for (const d of days) history.set(d.date, d.count);
  return {
    source: 'public-html',
    days,
    lastYearTotal: days.reduce((s, d) => s + d.count, 0),
    totalAllTime: [...history.values()].reduce((s, n) => s + n, 0),
    totalCommits: null,
    history,
    firstYear,
    languages: null,
  };
}

// ---------- Streaks ----------

const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function computeStreaks(history, today) {
  const dates = [...history.keys()].sort();
  let longest = { length: 0, start: null, end: null };
  let run = { length: 0, start: null };
  let prev = null;
  for (const date of dates) {
    const active = history.get(date) > 0;
    const contiguous = prev && addDays(prev, 1) === date;
    if (active) {
      run = run.length && contiguous ? { length: run.length + 1, start: run.start } : { length: 1, start: date };
      if (run.length > longest.length) longest = { length: run.length, start: run.start, end: date };
    } else run = { length: 0, start: null };
    prev = date;
  }
  // Current streak: ends today, or yesterday if today has no contributions yet.
  let cursor = (history.get(today) ?? 0) > 0 ? today : addDays(today, -1);
  const end = cursor;
  let length = 0;
  while ((history.get(cursor) ?? 0) > 0) {
    length++;
    cursor = addDays(cursor, -1);
  }
  const current = { length, start: length ? addDays(cursor, 1) : null, end: length ? end : null };
  return { current, longest };
}

export async function getContributionData(login, token) {
  let data;
  if (token) {
    try {
      data = await fromGraphQL(login, token);
    } catch (err) {
      console.warn(`[data] GraphQL unavailable (${err.message}); falling back to the public calendar.`);
    }
  } else {
    console.warn('[data] No GITHUB_TOKEN set; using the public calendar (commit totals and languages unavailable).');
  }
  data ??= await fromPublicHtml(login);
  const today = data.days[data.days.length - 1].date;
  return { ...data, today, streaks: computeStreaks(data.history, today) };
}
