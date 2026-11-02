# Future work: NCAA.com as a fallback play source

Status: built, never written to a database. Written 2026-11-02. Code is in
`dataAggregators/ingest/ncaa/` (`ingest.js` is a no-DB vet run unless `--write`); fixtures
in `dataAggregators/fixtures/ncaa/`; tests in `ingest/ncaa/canonical.test.js`. ESPN stays the
preferred live source.

## Open question: does the live feed log made free throws in the second text format?

NCAA's play-by-play comes in two text formats, and which one a game gets varies by game:

- **Format 1** (e.g. Queens (NC) vs Winthrop, 6649639): "Free Throw by X's Y" for makes,
  "Free Throw MISSED by ..." for misses. Made free throws are present, checked while the game
  was live.
- **Format 2** (e.g. Notre Dame at Villanova, 6651023): "Y makes two point jump shot" style.
  The doubled rows, missing offensive rebounds and missing offensive-foul rows are all
  present here too. **No made free throws appear at all**, only misses. We only fetched this
  game after it was final.

We don't know whether a format 2 game omits made free throws while it is live, or only in the
finished feed. `ingest/ncaa/normalize.js` (`repairSecondGrammar`) infers them from unexplained
score increases and credits the player who drew the last foul. That inference is a guess
for who shot, and it is the main source of the per-player free throw differences vs ESPN
(Royal 5 vs 3, Evans 3 vs 5 on the Villanova game).

To settle it: when a format 2 game is live, poll it (`ingest/ncaa/live.js --save-fixture`),
keep an early snapshot, and compare against its final feed. If the live feed does carry made
free throws, the inference only needs to run when none are logged, and the attribution
problem goes away for live use.

Only one game was live when this was checked, and it was format 1, so there was nothing to
test against.

## Other known gaps (vs ESPN, Notre Dame at Villanova)

- Assists 25 vs 26, offensive/defensive rebounds 21/43 vs 23/44, personal fouls 33 vs 36.
- ESPN-only events: the jump ball and a few team-level fouls.
- Inferred free throws are placed after the foul that earned them, but their clock can be
  off from ESPN's.
- Free throw trip sizes (`1of2`) are guessed from the run length in format 1.
- Only two games compared. Other formats may exist.
- NCAA's persisted-query hashes change when the site redeploys; override with
  `NCAA_PBP_HASH`, `NCAA_GAME_HASH`, `NCAA_BOX_HASH`.
- Matching NCAA players to existing ESPN players in the database (`resolvePlayer`, e.g.
  "Eesher Sarai" vs "Eesher Singh Sarai") is untested; check it on the first real `--write`.
