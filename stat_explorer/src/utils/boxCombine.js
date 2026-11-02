// Totals several single-game box payloads (public/data/box/<gameId>.json) into one payload of the same shape,
// so the regular Box score components can render it. Counts are summed and every rate is recomputed from the sums.
// Temporary: built for the two exhibition games. Per-game-only fields (events, plays) are dropped.

const SIDES = ['byu', 'opp'];
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const sum = (xs) => xs.reduce((a, x) => a + (isNum(x) ? x : 0), 0);
const div = (a, b) => (b ? a / b : null);
const wavg = (items, val, weight) => div(sum(items.map((i) => (val(i) || 0) * weight(i))), sum(items.map(weight)));

// Sums every numeric leaf of same-shaped objects; nested objects recurse, arrays concatenate.
function sumDeep(objs) {
  const first = objs.find((o) => o != null);
  if (isNum(first)) return sum(objs);
  if (Array.isArray(first)) return objs.flatMap((o) => o || []);
  if (first && typeof first === 'object') {
    const out = {};
    new Set(objs.flatMap((o) => Object.keys(o || {}))).forEach((k) => { out[k] = sumDeep(objs.map((o) => (o ? o[k] : undefined))); });
    return out;
  }
  return first;
}

const block = (bs) => {
  const n = sum(bs.map((b) => b.n));
  const pts = sum(bs.map((b) => b.pts));
  return { n, pts, ppp: div(pts, n) };
};

function combineSplit(ss) {
  const s = sumDeep(ss);
  const out = { ...s };
  ['firstShot', 'firstShotNoQuick', 'setHC', 'transition', 'quickPutback', 'reset'].forEach((k) => { out[k] = block(ss.map((x) => x[k])); });
  out.ppp = div(s.pts, s.poss);
  out.playsPerPoss = div(s.plays, s.poss);
  out.ppPlay = div(s.pts, s.plays);
  out.orebRate = div(s.oreb, s.oreb + s.dreb);
  return out;
}

function combineShooting(ss) {
  const s = sumDeep(ss);
  return {
    ...s,
    fgPct: div(s.fgm, s.fga), tpPct: div(s.tpm, s.tpa), twoPct: div(s.twoM, s.twoA), ftPct: div(s.ftm, s.fta),
    tpRate: div(s.tpa, s.fga), ftRate: div(s.fta, s.fga),
    efg: div(s.fgm + 0.5 * s.tpm, s.fga), ts: div(s.fgm * 2 + s.tpm + s.ftm, 2 * (s.fga + 0.44 * s.fta)),
  };
}

function combineAfterMake(as) {
  const a = sumDeep(as);
  const nonQuickN = sum(as.map((x) => x.nonQuickN));
  return {
    pop: a.pop, quick: a.quick, quickPts: a.quickPts, nonQuickN,
    quickPPP: div(a.quickPts, a.quick),
    pushRate: div(a.quick, a.pop),
    nonQuickPPP: wavg(as, (x) => x.nonQuickPPP, (x) => x.nonQuickN),
  };
}

const conv = (cs) => {
  const c = sumDeep(cs);
  return { ...c, rate: div(c.quick, c.n), ppe: div(c.pts, c.n) };
};

function combineHavoc(hs) {
  const h = sumDeep(hs);
  const squeezeOther = (x) => x.oppPoss - x.squeeze.n;
  return {
    ...h,
    rate: { strict: div(h.strict, h.oppPoss), broad: div(h.broad, h.oppPoss), mid: div(h.mid, h.oppPoss) },
    convLive: conv(hs.map((x) => x.convLive)),
    convDead: conv(hs.map((x) => x.convDead)),
    convAll: conv(hs.map((x) => x.convAll)),
    squeeze: {
      n: h.squeeze.n,
      rate: div(h.squeeze.n, h.oppPoss),
      ppp: wavg(hs, (x) => x.squeeze.ppp, (x) => x.squeeze.n),
      otherPPP: wavg(hs, (x) => x.squeeze.otherPPP, squeezeOther),
    },
  };
}

// Possessions-after-turnover value, shrunk toward the combined normal the same way the single-game numbers are.
function combineE(es, params) {
  const e = sumDeep(es);
  const norm = e.norm !== undefined ? wavg(es, (x) => x.norm, (x) => x.__poss) : null;
  const liveRaw = wavg(es, (x) => x.liveRaw, (x) => x.liveN);
  const k = params.SHRINK_K;
  return {
    norm,
    liveN: e.liveN, liveRaw,
    live: e.liveN || norm != null ? div((e.liveN * (liveRaw || 0)) + k * norm, e.liveN + k) : null,
    orebN: e.orebN, oreb: wavg(es, (x) => x.oreb, (x) => x.orebN),
    ftMissDefN: e.ftMissDefN, afterMadeFTN: e.afterMadeFTN,
    afterFtMiss: wavg(es, (x) => x.afterFtMiss, (x) => x.ftMissDefN),
    afterMadeFT: wavg(es, (x) => x.afterMadeFT, (x) => x.afterMadeFTN),
  };
}

function combineBattle(bs) {
  const b = sumDeep(bs);
  return { ...b, advPPP: wavg(bs, (x) => x.advPPP, (x) => x.advN) };
}

function combinePlayers(games) {
  const byKey = new Map();
  games.flatMap((g) => g.players).forEach((p) => {
    const key = `${p.side}|${p.name}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(p);
  });
  return [...byKey.values()].map((ps) => {
    const { name, side } = ps[0];
    const p = { ...sumDeep(ps), name, side };
    p.tovRate = div(p.tov, p.fga + 0.44 * p.fta + p.tov);
    p.per40 = p.min > 0 ? div((p.ptsCreated || 0) * 40, p.min) : null;
    return p;
  });
}

export function combineBoxes(games, { label, opponents }) {
  const first = games[0];
  const E_in = SIDES.map((s) => games.map((g) => ({ ...g.E[s], __poss: g.split[s].poss })));
  const per = (key, fn) => Object.fromEntries(SIDES.map((s) => [s, fn(games.map((g) => g[key][s]))]));
  const final = { byu: sum(games.map((g) => g.header.final.byu)), opp: sum(games.map((g) => g.header.final.opp)) };
  const margin = first.margin.map((row, i) => {
    const rows = games.map((g) => g.margin[i]);
    const byu = { pts: sum(rows.map((r) => r.byu.pts)), n: sum(rows.map((r) => r.byu.n)) };
    const opp = { pts: sum(rows.map((r) => r.opp.pts)), n: sum(rows.map((r) => r.opp.n)) };
    return { k: row.k, label: row.label, byu, opp, net: byu.pts - opp.pts };
  });
  const wins = games.filter((g) => g.header.final.byu > g.header.final.opp).length;
  return {
    schema: first.schema,
    header: {
      gameId: 'exhibitions',
      date: games[games.length - 1].header.date,
      venue: null,
      seasonType: null,
      neutral: false,
      focus: 'byu',
      teams: { byu: first.header.teams.byu, opp: opponents },
      final,
      margin: final.byu - final.opp,
      headline: `${label}: ${wins}-${games.length - wins}, combined margin ${final.byu - final.opp >= 0 ? '+' : ''}${final.byu - final.opp} over ${games.length} games.`,
      minutes: first.header.minutes,
    },
    params: first.params,
    notes: first.notes,
    split: per('split', combineSplit),
    shooting: per('shooting', combineShooting),
    margin,
    afterMake: per('afterMake', combineAfterMake),
    ato: per('ato', sumDeep),
    E: { byu: combineE(E_in[0], first.params), opp: combineE(E_in[1], first.params) },
    havoc: per('havoc', combineHavoc),
    battle: per('battle', combineBattle),
    line: per('line', sumDeep),
    players: combinePlayers(games),
    checks: games.flatMap((g) => g.checks.map((c) => ({ ...c, name: `${g.header.teams.opp}: ${c.name}` }))),
  };
}
