// Tuning for the season "Notable records" (killsRecords.js). Edit freely; nothing else needs to change.
export const RECORDS_CONFIG = {
  minGames: 5,          // a record needs at least this many games
  minWinPct: 0.8,       // ...and at least this win rate
  maxCoverage: 0.6,     // ...and may describe at most this share of the season's games (unless the threshold is past the season average)
  maxP: 0.05,           // ...and the games outside it must do clearly worse (one-sided Fisher exact)
  maxRecords: 6,

  // The loosest threshold that still counts as impressive, per metric. Anything looser is never
  // used, alone or in a pair: "5 or fewer avoidable breakers" is not impressive for a team that
  // averages 2.6. For a 'more is better' metric this is a floor; for 'fewer is better', a ceiling.
  // Leave a metric out for no limit.
  loosest: {
    avoidableBreakers: 3,
  },
};
