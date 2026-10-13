// Builds the season clutch file from the per-game clutch summaries.
// Usage: node derivations/aggregate-clutch.js --season 2025 [--team byu] [--base DIR|URL]
//          [--index PATH|URL] [--out-dir DIR] [--meta-base DIR|URL]
//   --base     where clutch/games/<id>.json live (default: the data CloudFront). A local dir must use
//              the same layout, e.g. <tmp> holding clutch/games/ as written by export-game-clutch.js.
//   --meta-base where pbp/games/<id>.meta.json live, for player headshots (default: the data CloudFront).
//   --index    the games list (default: <base>/games/index.json); used to pick the season's games.
//   --out-dir  writes <out-dir>/seasons/<season>.json and merges the season into seasons/index.json
//              (default <tmp>/clutch). Upload both with ingest/tools/upload.js to clutch/seasons/.
// The season is rebuilt from scratch every run. Refuses to mix clutch rules versions.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { clutchSeason } = require('./app-modules');

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
  if (!season) throw new Error('usage: aggregate-clutch.js --season <seasonYear> [--team byu] [--base DIR|URL] [--index PATH|URL] [--out-dir DIR]');
  const team = opt('--team') || 'byu';
  const base = opt('--base') || CDN;
  const metaBase = opt('--meta-base') || CDN;
  const outDir = opt('--out-dir') || path.join(os.tmpdir(), 'clutch');

  const index = await readJson(opt('--index') || join(base, 'games/index.json'));
  const games = index.filter(g => g.seasonYear === season && g.status === 'final' && (g.homeTeamId === team || g.awayTeamId === team));
  if (!games.length) throw new Error(`no final ${team} games for season ${season} in the games index`);

  const summaries = [];
  const skipped = [];
  for (const g of games) {
    try {
      summaries.push(await readJson(join(base, `clutch/games/${g.gameId}.json`)));
    } catch (err) {
      skipped.push({ gameId: g.gameId, reason: `no usable summary (${err.message})` });
    }
  }
  warnIfMissingSeasonTypes(summaries);

  // Headshots come from each game's meta file; a game without one just has no photos.
  const headshots = {};
  for (const s of summaries) {
    try { Object.assign(headshots, (await readJson(join(metaBase, `pbp/games/${s.gameId}.meta.json`))).headshots); }
    catch (err) { console.warn(`no headshots for ${s.gameId} (${err.message})`); }
  }

  const result = clutchSeason.buildSeason({ season, team, summaries, skipped, headshots });
  const seasonsDir = path.join(outDir, 'seasons');
  fs.mkdirSync(seasonsDir, { recursive: true });
  const file = path.join(seasonsDir, `${season}.json`);
  fs.writeFileSync(file, JSON.stringify(result));

  // Merge this season into the list the app uses for its season picker.
  const indexFile = path.join(seasonsDir, 'index.json');
  let seasons = [];
  try { seasons = await readJson(fs.existsSync(indexFile) ? indexFile : join(base, 'clutch/seasons/index.json')); } catch (err) { /* first season */ }
  seasons = seasons.filter(s => !(s.season === season && s.team === team));
  seasons.push({ season, team, games: result.gamesIncluded, generatedAt: result.generatedAt });
  seasons.sort((a, b) => b.season - a.season);
  fs.writeFileSync(indexFile, JSON.stringify(seasons));

  console.log(`${season} ${team}: ${result.gamesIncluded} games, ${result.gamesSkipped.length} skipped -> ${file}`);
  const d = result.derived;
  console.log(`  clutch games ${result.totals.clutchGames}, record ${d.record.w}-${d.record.l}, ` +
    `points ${result.totals.for.pts}-${result.totals.against.pts} (net ${d.net >= 0 ? '+' : ''}${d.net}, ${d.perGame.net === null ? '-' : d.perGame.net.toFixed(1)} per clutch game)`);
  result.gamesSkipped.forEach(s => console.log(`  skipped ${s.gameId}: ${s.reason}`));
}

main().catch(err => { console.error(err.message); process.exit(1); });
