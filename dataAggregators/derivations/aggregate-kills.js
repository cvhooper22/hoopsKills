// Builds the season kills file from the per-game kills summaries.
// Usage: node derivations/aggregate-kills.js --season 2025 [--team byu] [--base DIR|URL]
//          [--index PATH|URL] [--out-dir DIR]
//   --base     where kills/games/<id>.json live (default: the data CloudFront). A local dir must use
//              the same layout, e.g. <tmp> holding kills/games/ as written by export-game-kills.js.
//   --index    the games list (default: <base>/games/index.json); used to pick the season's games.
//   --out-dir  writes <out-dir>/seasons/<season>.json and merges the season into seasons/index.json
//              (default <tmp>/kills). Upload both with ingest/tools/upload.js to kills/seasons/.
// The season is rebuilt from scratch every run. Refuses to mix kill-rule versions.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { killsSeason } = require('./app-modules');

const CDN = 'https://dd0v7fgd2sjsh.cloudfront.net';

async function readJson(location) {
  if (/^https?:/.test(location)) {
    const res = await fetch(location);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  return JSON.parse(fs.readFileSync(location, 'utf8'));
}

const join = (base, rel) => (/^https?:/.test(base) ? `${base.replace(/\/$/, '')}/${rel}` : path.join(base, rel));

// Postseason games sitting in a season with no types assigned would silently count as regular season.
function warnIfMissingSeasonTypes(summaries) {
  const lateGames = summaries.filter(s => s.game.date.slice(5) >= '03-10');
  if (lateGames.length && summaries.every(s => s.game.seasonType === 'regular')) {
    console.warn(`WARNING: ${lateGames.length} game(s) in mid-March or later but none are marked conf_tourney/postseason. ` +
      'Check config/season-boundaries.json and run ingest/tools/apply-season-types.js, then re-export the summaries.');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const season = Number(opt('--season'));
  if (!season) throw new Error('usage: aggregate-kills.js --season <seasonYear> [--team byu] [--base DIR|URL] [--index PATH|URL] [--out-dir DIR]');
  const team = opt('--team') || 'byu';
  const base = opt('--base') || CDN;
  const outDir = opt('--out-dir') || path.join(os.tmpdir(), 'kills');

  const index = await readJson(opt('--index') || join(base, 'games/index.json'));
  const games = index.filter(g => g.seasonYear === season && g.status === 'final' && (g.homeTeamId === team || g.awayTeamId === team));
  if (!games.length) throw new Error(`no final ${team} games for season ${season} in the games index`);

  const summaries = [];
  const skipped = [];
  for (const g of games) {
    try {
      summaries.push(await readJson(join(base, `kills/games/${g.gameId}.json`)));
    } catch (err) {
      skipped.push({ gameId: g.gameId, reason: `no usable summary (${err.message})` });
    }
  }
  warnIfMissingSeasonTypes(summaries);

  const result = killsSeason.buildSeason({ season, team, summaries, skipped });
  const seasonsDir = path.join(outDir, 'seasons');
  fs.mkdirSync(seasonsDir, { recursive: true });
  const file = path.join(seasonsDir, `${season}.json`);
  fs.writeFileSync(file, JSON.stringify(result));

  // Merge this season into the list the app uses for its season picker.
  const indexFile = path.join(seasonsDir, 'index.json');
  let seasons = [];
  try { seasons = await readJson(fs.existsSync(indexFile) ? indexFile : join(base, 'kills/seasons/index.json')); } catch (err) { /* first season */ }
  seasons = seasons.filter(s => !(s.season === season && s.team === team));
  seasons.push({ season, team, games: result.gamesIncluded, generatedAt: result.generatedAt });
  seasons.sort((a, b) => b.season - a.season);
  fs.writeFileSync(indexFile, JSON.stringify(seasons));

  const t = result.totals;
  const d = result.derived;
  console.log(`${season} ${team}: ${result.gamesIncluded} games, ${result.gamesSkipped.length} skipped -> ${file}`);
  console.log(`  kills ${t.kills} (against ${t.oppKills}, diff ${d.diff >= 0 ? '+' : ''}${d.diff}), potential ${t.potential}, stops ${t.stops}`);
  console.log(`  completion ${(d.completion * 100).toFixed(1)}%, efficiency ${d.efficiency === null ? '-' : d.efficiency.toFixed(2)}, ` +
    `longest streak ${d.longestStreak ? `${d.longestStreak.length} (${d.longestStreak.games.map(g => g.oppTeamId).join(', ')})` : '-'}`);
  result.gamesSkipped.forEach(s => console.log(`  skipped ${s.gameId}: ${s.reason}`));
}

main().catch(err => { console.error(err.message); process.exit(1); });
