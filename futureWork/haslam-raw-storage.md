# Future work: Haslametrics raw XML storage

Status: not started. Written 2026-11-03. The collector (`dataAggregators/ingest/rankings/haslam.js`)
stores the whole `ratings.xml` in `raw_payloads` whenever a snapshot is new or changed, so
`ingest/rankings/recompute.js` can re-derive a snapshot after a parsing fix (the site only serves
today's file). Nothing below is needed yet; it is the cost side of that choice.

## Measured so far

- One stored XML is about 350 kB in the database (1.08 MB of JSON text, TOAST-compressed about 3x).
- Haslametrics updates about daily, so a full season is roughly 150 snapshots, about 50 MB.
  For scale: Torvik's raw data is 21 MB for 165 snapshots, and `team_ratings` is 36 MB.
- Unchanged ingests store nothing (the content hash matches), so repeated runs on one day are free
  unless the site's content changed in between.

## Leak to fix regardless of the option chosen

When a snapshot is replaced (same system, season and through-date, changed content), `writeSnapshot`
in `ingest/rankings/lib/store.js` inserts the new raw payload and repoints `raw_id`, but never
deletes the superseded `raw_payloads` row. Re-running during a day the site updates piles up
full-size orphans. The fix is to delete the old raw row (when nothing else references it) in the
same transaction as the replace, and the same when `raw_id` is repointed in the "unchanged but
raw differs" branch.

## Options

1. **Leave it.** About 50 MB per season, simplest, everything stays recomputable.
2. **Compress it (recommended).** Gzip the XML before storing (a `bytea` column or a base64 string
   in the payload) and have `recompute.js` and `haslam-history.js` unzip it. The repeated attribute
   names should compress well, probably 6-8x, which would put a season at roughly 10-15 MB. That ratio
   is a guess; measure it on a real file first.
3. **Keep only what recompute needs.** Store the per-team component fields and team names, not the
   whole XML. Smallest, but it means deciding up front which fields a future formula change might
   want, and dropping the rest cannot be undone.

Combine any of these with the orphan cleanup above.

## Related

The latest XML also carries a daily rank history for every team (`<trd>`, `<otr>`, `<dtr>`, `<tr>`),
so older raw payloads are mostly redundant for ranks. They are not redundant for ratings or
component fields, which is why option 3 is a judgment call. `haslam-history.js --repair` uses that
history to fix snapshots flagged `off_def_valid = false`.
