// Notable records for a season: "BYU is 7-1 when they get 8 kills". Pure; no I/O.
//
// A record is a list of conditions on a season file's per-game rows (killsSeason.js gameRow) plus
// the W-L of the games that meet all of them. `evaluate` is the one place that math lives, so a
// future user-built query view can call it with conditions the user picked.

import { RECORDS_CONFIG as CFG } from './killsRecordsConfig.js';

// op '>=' means more is better, '<=' means fewer is better. `ladder` lists the thresholds to try,
// given the values the season actually has, loosest first.
export const METRICS = {
  kills: {
    op: '>=', get: (r) => r.kills,
    ladder: (vs) => range(Math.min(...vs), Math.max(...vs), 1),
    phrase: (op, v) => `get ${v} or more kills`,
  },
  stops: {
    op: '>=', get: (r) => r.stops,
    ladder: (vs) => range(Math.min(...vs), Math.max(...vs), 1),
    phrase: (op, v) => `get ${v} or more stops`,
  },
  completion: {
    op: '>=', get: (r) => r.completion,
    ladder: (vs) => range(Math.ceil(Math.min(...vs) * 20) / 20, Math.max(...vs), 0.05),
    phrase: (op, v) => `complete ${Math.round(v * 100)}% or more of their kill chances`,
  },
  efficiency: {
    op: '>=', get: (r) => r.efficiency,
    ladder: (vs) => range(Math.ceil(Math.min(...vs) * 2) / 2, Math.max(...vs), 0.5),
    phrase: (op, v) => `average ${v.toFixed(1)} or more net points per kill`,
  },
  avoidableBreakers: {
    op: '<=', get: (r) => r.avoidableBreakers,
    ladder: (vs) => range(Math.min(...vs), Math.max(...vs), 1),
    phrase: (op, v) => (v === 0 ? 'allow no avoidable streak breakers' : `allow ${v} or fewer avoidable streak breakers`),
  },
};

function range(from, to, step) {
  const out = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++) out.push(Math.round((from + i * step) * 1e6) / 1e6);
  return out;
}

const meets = (row, { metric, op, value }) => {
  const v = METRICS[metric].get(row);
  if (v === null || v === undefined) return false;
  return op === '>=' ? v >= value : v <= value;
};

const wl = (rows) => {
  const wins = rows.filter((r) => r.result === 'W').length;
  return { games: rows.length, wins, losses: rows.length - wins, winPct: rows.length ? wins / rows.length : null };
};

// W-L over the rows that satisfy every condition, plus `rest`: the W-L of every other game, which
// is what makes a record mean something ("22-1 when they get 5 kills" only impresses if the other
// games are much worse). `p` is the one-sided Fisher exact probability that a split this lopsided
// (matched games winning more than the rest) happens by chance.
export function evaluate(rows, conditions) {
  const matched = rows.filter((r) => conditions.every((c) => meets(r, c)));
  const rest = rows.filter((r) => !matched.includes(r));
  const res = wl(matched);
  const other = wl(rest);
  return { ...res, rest: other, coverage: rows.length ? matched.length / rows.length : 0, p: fisherP(res, other) };
}

// P(at least this many wins fall in the matched group | the totals), hypergeometric.
function fisherP(a, b) {
  const n = a.games + b.games;
  const wins = a.wins + b.wins;
  if (!a.games || !b.games) return 1;
  const logC = (x, y) => logFact(x) - logFact(y) - logFact(x - y);
  let p = 0;
  for (let k = a.wins; k <= Math.min(a.games, wins); k++) {
    if (wins - k > b.games) continue;
    p += Math.exp(logC(a.games, k) + logC(n - a.games, wins - k) - logC(n, wins));
  }
  return Math.min(1, p);
}

function logFact(n) {
  let t = 0;
  for (let i = 2; i <= n; i++) t += Math.log(i);
  return t;
}

// A record is worth showing when it is big enough, wins at least 80%, doesn't just describe most
// of the season (a loose threshold is the season record in disguise), and the games outside it do
// clearly worse. `beyondAverage` lets a threshold past the season average through the coverage cap.
function qualifies(res, beyondAverage) {
  return res.games >= CFG.minGames && res.winPct >= CFG.minWinPct
    && (res.coverage <= CFG.maxCoverage || beyondAverage)
    && res.rest.games > 0 && res.winPct > res.rest.winPct && res.p <= CFG.maxP;
}

const better = (x, y) => !y || x.p < y.p || (x.p === y.p && x.games > y.games);

// Thresholds for one metric, in any order; the best is the one the games outside separate from
// the most, not the loosest.
function steps(rows, metric) {
  const def = METRICS[metric];
  const vals = rows.map(def.get).filter((v) => v !== null && v !== undefined);
  if (!vals.length) return { ladder: [], avg: null };
  const limit = CFG.loosest[metric];
  const impressive = (v) => limit === undefined || (def.op === '>=' ? v >= limit : v <= limit);
  return { ladder: def.ladder(vals).filter(impressive), avg: vals.reduce((x, y) => x + y, 0) / vals.length };
}

const beyond = (metric, value, avg) => (METRICS[metric].op === '>=' ? value >= avg : value <= avg);

function single(rows, metric) {
  const { ladder, avg } = steps(rows, metric);
  let best = null;
  ladder.forEach((value) => {
    const conditions = [{ metric, op: METRICS[metric].op, value }];
    const result = evaluate(rows, conditions);
    const rec = { conditions, ...result };
    if (qualifies(result, beyond(metric, value, avg)) && better(rec, best)) best = rec;
  });
  return best;
}

function pair(rows, a, b) {
  const A = steps(rows, a);
  const B = steps(rows, b);
  let best = null;
  A.ladder.forEach((va) => B.ladder.forEach((vb) => {
    const conditions = [{ metric: a, op: METRICS[a].op, value: va }, { metric: b, op: METRICS[b].op, value: vb }];
    const result = evaluate(rows, conditions);
    const rec = { conditions, ...result };
    if (qualifies(result, false) && better(rec, best)) best = rec;
  }));
  return best;
}

// Tries each metric alone first. A metric with no qualifying threshold on its own is then tried in
// combination with the others. Ranked by how unlikely the contrast is by chance, then sample size.
export function findRecords(rows) {
  const metrics = Object.keys(METRICS);
  const found = [];
  const failed = [];
  metrics.forEach((m) => {
    const rec = single(rows, m);
    if (rec) found.push(rec); else failed.push(m);
  });
  failed.forEach((a, i) => {
    metrics.filter((m) => m !== a && (!failed.includes(m) || failed.indexOf(m) > i)).forEach((b) => {
      const rec = pair(rows, a, b);
      if (rec) found.push(rec);
    });
  });
  return found
    .sort((x, y) => x.p - y.p || y.games - x.games)
    .slice(0, CFG.maxRecords);
}

// "5-7 in every other game", the contrast shown under a record.
export function restSentence(record) {
  return `${record.rest.wins}-${record.rest.losses} when they don't`;
}

export function recordSentence(record, team = 'BYU') {
  const when = record.conditions.map((c) => METRICS[c.metric].phrase(c.op, c.value)).join(' and ');
  return `${team} is ${record.wins}-${record.losses} when they ${when}`;
}
