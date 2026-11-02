// Bart Torvik (T-Rank). Torvik publishes a "time machine": one file per date holding the full table (all D-I teams)
// as it stood that morning, so any past day can be collected, not only today's. Free, plain HTTP, no login.
//   https://barttorvik.com/timemachine/team_results/YYYYMMDD_team_results.json.gz
// A file dated D contains the games played on D too: BYU's record changes in exactly the file dated for each game
// (checked against all 35 BYU games of 2025-26), so through_date = D. For a game on G the pre-game ratings are the
// file dated G-1.
// Rows have no header; the layout is the one of the team_results.csv, 45 values per team.
const zlib = require('zlib');
const fetch = require('node-fetch');

const URL_FOR = (yyyymmdd) => `https://barttorvik.com/timemachine/team_results/${yyyymmdd}_team_results.json.gz`;
const UA = 'Mozilla/5.0 (hoopsKills personal stats project)';

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDate, n) => { const d = new Date(isoDate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

/** rows: the parsed JSON array for the file dated `fileDate` (YYYY-MM-DD). */
function parseTimeMachine(rows, fileDate) {
  if (!Array.isArray(rows) || !rows.length || rows[0].length !== 45) {
    throw new Error(`torvik ${fileDate}: unexpected layout (${rows && rows[0] ? rows[0].length : 'no'} columns, expected 45)`);
  }
  const out = rows.map((r) => {
    const n = r.length;
    return {
      name: r[1], conference: r[2], record: r[3],
      overall: { rank: num(r[9]), rating: num(r[8]) },          // rank by Barthag; rating = Barthag
      off: { rank: num(r[5]), rating: num(r[4]) },
      def: { rank: num(r[7]), rating: num(r[6]) },
      metrics: {
        barthag: num(r[8]), adjem: r[4] !== null && r[6] !== null ? +(r[4] - r[6]).toFixed(3) : null,
        adjt: num(r[n - 1]), wab: num(r[n - 4]), wab_rank: num(r[n - 3]), fun_rank: num(r[n - 2]),
        proj_wins: num(r[10]), proj_losses: num(r[11]), conf_record: r[14],
        sos: num(r[15]), ncsos: num(r[16]), consos: num(r[17]), opp_oe: num(r[23]), opp_de: num(r[24]), conf_win_pct: num(r[n - 5]),
      },
    };
  });
  return { throughDate: fileDate, asofLabel: `Torvik time machine ${fileDate}`, rows: out };
}

/** Fetches the file dated `fileDate` (YYYY-MM-DD). Returns { rows (raw), snap } or null when there is no such file. */
async function fetchDate(fileDate) {
  // a date with no file yet (today's, before the morning build) answers 302 -> the home page, not 404; following it
  // would hand us HTML, so do not follow redirects
  const res = await fetch(URL_FOR(fileDate.replace(/-/g, '')), { headers: { 'user-agent': UA }, redirect: 'manual' });
  if (res.status === 404 || (res.status >= 300 && res.status < 400)) return null;
  if (!res.ok) throw new Error(`torvik ${fileDate}: HTTP ${res.status}`);
  // the file is gzip; depending on the response headers the HTTP client may already have unzipped it once
  let buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  const raw = JSON.parse(buf.toString('utf8'));
  const parsed = parseTimeMachine(raw, fileDate);
  return { raw, snap: { system: 'torvik', ...parsed, teamsExpected: raw.length, raw } };
}

/** Latest available: today's file, else yesterday's, and so on (a day's file appears after that day's games, usually the next morning). */
async function fetchLatest(today = iso(new Date())) {
  for (let back = 0; back <= 3; back++) {
    const got = await fetchDate(addDays(today, -back));
    if (got) return got;
  }
  throw new Error('torvik: no time machine file in the last 4 days');
}

module.exports = { parseTimeMachine, fetchDate, fetchLatest, addDays, iso };
