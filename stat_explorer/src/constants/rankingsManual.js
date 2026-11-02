// BYU's 2025-26 KenPom, EvanMiya and Haslametrics ratings, hand-tracked in "2026 Metrics.xlsx" through Feb 10, 2026.
// Hardcoded for that season only: those three systems were not being collected then (collection started with 2026-27;
// Torvik and NET come from the database through the rankings timeline file). Only BYU's own row exists for them,
// so these series can be drawn but never used to filter opponents.
//
// `date` is the date the ratings are as of (games through that day), in the same sense as the collected snapshots.
// The sheet's own dates were the days the numbers were written down, sometimes before that day's game; where the sheet's
// W-L record only matches the games table on an earlier day, `date` was moved back to the last day on which it does
// (`sheetDate` keeps the original). Ratings are points per 100 possessions for KenPom and Haslametrics, and points above
// average for EvanMiya (higher is better for both of its parts).
//
// Fields per point: date, sheetDate, record, overallRank, offRating, offRank, defRating, defRank.

export const MANUAL_SEASON = 2025;

export const MANUAL_THROUGH = "2026-02-09"; // the sheet stops here

export const MANUAL_SYSTEMS = {
  kenpom: {
    name: "KenPom",
    points: [
      { date: "2025-10-31", sheetDate: "2025-10-31", record: "0-0", overallRank: 18, offRating: 120.9, offRank: 4, defRating: 97.8, defRank: 55 },
      { date: "2025-11-07", sheetDate: "2025-11-07", record: "1-0", overallRank: 17, offRating: 120.2, offRank: 8, defRating: 97.1, defRank: 47 },
      { date: "2025-11-10", sheetDate: "2025-11-10", record: "2-0", overallRank: 16, offRating: 121.1, offRank: 10, defRating: 97.3, defRank: 40 },
      { date: "2025-11-18", sheetDate: "2025-11-18", record: "3-1", overallRank: 16, offRating: 123.1, offRank: 7, defRating: 99.2, defRank: 45 },
      { date: "2025-11-20", sheetDate: "2025-11-21", record: "3-1", overallRank: 17, offRating: 123.4, offRank: 5, defRating: 99.7, defRank: 50 },
      { date: "2025-11-24", sheetDate: "2025-11-24", record: "4-1", overallRank: 8, offRating: 125.0, offRank: 4, defRating: 98.4, defRank: 27 },
      { date: "2025-11-27", sheetDate: "2025-11-28", record: "5-1", overallRank: 8, offRating: 124.2, offRank: 5, defRating: 97.0, defRank: 18 },
      { date: "2025-11-29", sheetDate: "2025-11-29", record: "6-1", overallRank: 12, offRating: 123.9, offRank: 9, defRating: 97.4, defRank: 22 },
      { date: "2025-12-02", sheetDate: "2025-12-03", record: "6-1", overallRank: 12, offRating: 123.9, offRank: 5, defRating: 97.3, defRank: 23 },
      { date: "2025-12-05", sheetDate: "2025-12-05", record: "7-1", overallRank: 11, offRating: 124.7, offRank: 5, defRating: 96.9, defRank: 18 },
      { date: "2025-12-08", sheetDate: "2025-12-09", record: "7-1", overallRank: 9, offRating: 124.5, offRank: 6, defRating: 96.6, defRank: 19 },
      { date: "2025-12-12", sheetDate: "2025-12-15", record: "8-1", overallRank: 9, offRating: 124.3, offRank: 9, defRating: 96.3, defRank: 14 },
      { date: "2025-12-23", sheetDate: "2025-12-23", record: "12-1", overallRank: 11, offRating: 124.9, offRank: 9, defRating: 96.7, defRank: 19 },
      { date: "2026-01-06", sheetDate: "2026-01-06", record: "13-1", overallRank: 10, offRating: 124.4, offRank: 10, defRating: 96.2, defRank: 17 },
      { date: "2026-01-09", sheetDate: "2026-01-10", record: "14-1", overallRank: 11, offRating: 125.0, offRank: 8, defRating: 96.0, defRank: 14 },
      { date: "2026-01-12", sheetDate: "2026-01-12", record: "15-1", overallRank: 11, offRating: 125.1, offRank: 8, defRating: 96.8, defRank: 17 },
      { date: "2026-01-16", sheetDate: "2026-01-17", record: "16-1", overallRank: 13, offRating: 125.3, offRank: 8, defRating: 97.6, defRank: 19 },
      { date: "2026-01-20", sheetDate: "2026-01-20", record: "16-2", overallRank: 15, offRating: 125.2, offRank: 12, defRating: 98.5, defRank: 19 },
      { date: "2026-01-25", sheetDate: "2026-01-26", record: "17-2", overallRank: 15, offRating: 125.2, offRank: 12, defRating: 98.9, defRank: 25 },
      { date: "2026-01-28", sheetDate: "2026-01-28", record: "17-3", overallRank: 15, offRating: 125.2, offRank: 11, defRating: 98.8, defRank: 25 },
      { date: "2026-02-06", sheetDate: "2026-02-07", record: "17-5", overallRank: 19, offRating: 125.7, offRank: 10, defRating: 100.5, defRank: 43 },
      { date: "2026-02-09", sheetDate: "2026-02-10", record: "17-6", overallRank: 22, offRating: 125.3, offRank: 11, defRating: 100.9, defRank: 49 },
    ],
  },
  evanmiya: {
    name: "EvanMiya",
    points: [
      { date: "2025-10-31", sheetDate: "2025-10-31", record: "0-0", overallRank: 9, offRating: 14.6, offRank: 4, defRating: 7.0, defRank: 35 },
      { date: "2025-11-07", sheetDate: "2025-11-07", record: "1-0", overallRank: 16, offRating: 12.9, offRank: 11, defRating: 7.9, defRank: 28 },
      { date: "2025-11-10", sheetDate: "2025-11-10", record: "2-0", overallRank: 13, offRating: 12.6, offRank: 13, defRating: 9.4, defRank: 18 },
      { date: "2025-11-18", sheetDate: "2025-11-18", record: "3-1", overallRank: 14, offRating: 14.1, offRank: 8, defRating: 7.9, defRank: 31 },
      { date: "2025-11-20", sheetDate: "2025-11-21", record: "3-1", overallRank: 14, offRating: 14.3, offRank: 7, defRating: 8.0, defRank: 30 },
      { date: "2025-11-24", sheetDate: "2025-11-24", record: "4-1", overallRank: 6, offRating: 16.6, offRank: 4, defRating: 9.9, defRank: 19 },
      { date: "2025-11-27", sheetDate: "2025-11-28", record: "5-1", overallRank: 7, offRating: 16.2, offRank: 5, defRating: 10.8, defRank: 14 },
      { date: "2025-11-29", sheetDate: "2025-11-29", record: "6-1", overallRank: 10, offRating: 15.1, offRank: 8, defRating: 9.6, defRank: 18 },
      { date: "2025-12-02", sheetDate: "2025-12-03", record: "6-1", overallRank: 12, offRating: 14.4, offRank: 10, defRating: 10.0, defRank: 19 },
      { date: "2025-12-05", sheetDate: "2025-12-05", record: "7-1", overallRank: 10, offRating: 14.8, offRank: 7, defRating: 10.4, defRank: 14 },
      { date: "2025-12-08", sheetDate: "2025-12-09", record: "7-1", overallRank: 10, offRating: 15.0, offRank: 9, defRating: 10.6, defRank: 16 },
      { date: "2025-12-12", sheetDate: "2025-12-15", record: "8-1", overallRank: 11, offRating: 14.6, offRank: 12, defRating: 11.6, defRank: 13 },
      { date: "2025-12-23", sheetDate: "2025-12-23", record: "12-1", overallRank: 9, offRating: 15.8, offRank: 9, defRating: 10.9, defRank: 16 },
      { date: "2026-01-06", sheetDate: "2026-01-06", record: "13-1", overallRank: 10, offRating: 15.4, offRank: 11, defRating: 11.6, defRank: 15 },
      { date: "2026-01-09", sheetDate: "2026-01-10", record: "14-1", overallRank: 8, offRating: 16.0, offRank: 9, defRating: 12.1, defRank: 14 },
      { date: "2026-01-12", sheetDate: "2026-01-12", record: "15-1", overallRank: 9, offRating: 15.6, offRank: 8, defRating: 11.3, defRank: 15 },
      { date: "2026-01-16", sheetDate: "2026-01-17", record: "16-1", overallRank: 10, offRating: 15.1, offRank: 9, defRating: 11.4, defRank: 15 },
      { date: "2026-01-20", sheetDate: "2026-01-20", record: "16-2", overallRank: 14, offRating: 14.0, offRank: 14, defRating: 10.8, defRank: 18 },
      { date: "2026-01-25", sheetDate: "2026-01-26", record: "17-2", overallRank: 15, offRating: 15.2, offRank: 9, defRating: 10.2, defRank: 18 },
      { date: "2026-01-28", sheetDate: "2026-01-28", record: "17-3", overallRank: 15, offRating: 14.7, offRank: 11, defRating: 9.7, defRank: 21 },
      { date: "2026-02-06", sheetDate: "2026-02-07", record: "17-5", overallRank: 16, offRating: 15.5, offRank: 7, defRating: 8.3, defRank: 33 },
      { date: "2026-02-09", sheetDate: "2026-02-10", record: "17-6", overallRank: 21, offRating: 15.2, offRank: 11, defRating: 7.3, defRank: 41 },
    ],
  },
  haslam: {
    name: "Haslametrics",
    points: [
      { date: "2025-10-31", sheetDate: "2025-10-31", record: "0-0", overallRank: 12, offRating: 119.24, offRank: 8, defRating: 96.71, defRank: 33 },
      { date: "2025-11-07", sheetDate: "2025-11-07", record: "1-0", overallRank: 16, offRating: 118.08, offRank: 10, defRating: 95.34, defRank: 21 },
      { date: "2025-11-10", sheetDate: "2025-11-10", record: "2-0", overallRank: 8, offRating: 118.92, offRank: 11, defRating: 93.63, defRank: 8 },
      { date: "2025-11-18", sheetDate: "2025-11-18", record: "3-1", overallRank: 8, offRating: 123.08, offRank: 7, defRating: 95.85, defRank: 12 },
      { date: "2025-11-20", sheetDate: "2025-11-21", record: "3-1", overallRank: 10, offRating: 123.12, offRank: 8, defRating: 96.17, defRank: 14 },
      { date: "2025-11-24", sheetDate: "2025-11-24", record: "4-1", overallRank: 12, offRating: 123.27, offRank: 5, defRating: 95.67, defRank: 14 },
      { date: "2025-11-27", sheetDate: "2025-11-28", record: "5-1", overallRank: 12, offRating: 123.59, offRank: 8, defRating: 93.41, defRank: 8 },
      { date: "2025-11-29", sheetDate: "2025-11-29", record: "6-1", overallRank: 16, offRating: 123.75, offRank: 9, defRating: 94.78, defRank: 11 },
      { date: "2025-12-02", sheetDate: "2025-12-03", record: "6-1", overallRank: 20, offRating: 124.12, offRank: 9, defRating: 95.25, defRank: 16 },
      { date: "2025-12-05", sheetDate: "2025-12-05", record: "7-1", overallRank: 12, offRating: 126.24, offRank: 5, defRating: 93.91, defRank: 12 },
      { date: "2025-12-08", sheetDate: "2025-12-09", record: "7-1", overallRank: 12, offRating: 126.21, offRank: 9, defRating: 93.39, defRank: 13 },
      { date: "2025-12-12", sheetDate: "2025-12-15", record: "8-1", overallRank: 13, offRating: 125.18, offRank: 12, defRating: 92.23, defRank: 13 },
      { date: "2025-12-23", sheetDate: "2025-12-23", record: "12-1", overallRank: 20, offRating: 125.62, offRank: 14, defRating: 96.54, defRank: 27 },
      { date: "2026-01-06", sheetDate: "2026-01-06", record: "13-1", overallRank: 14, offRating: 125.21, offRank: 16, defRating: 95.91, defRank: 20 },
      { date: "2026-01-09", sheetDate: "2026-01-10", record: "14-1", overallRank: 13, offRating: 126.16, offRank: 10, defRating: 94.89, defRank: 18 },
      { date: "2026-01-12", sheetDate: "2026-01-12", record: "15-1", overallRank: 13, offRating: 125.79, offRank: 11, defRating: 95.91, defRank: 17 },
      { date: "2026-01-16", sheetDate: "2026-01-17", record: "16-1", overallRank: 16, offRating: 125.67, offRank: 10, defRating: 96.3, defRank: 18 },
      { date: "2026-01-20", sheetDate: "2026-01-20", record: "16-2", overallRank: 20, offRating: 124.73, offRank: 19, defRating: 97.09, defRank: 20 },
      { date: "2026-01-25", sheetDate: "2026-01-26", record: "17-2", overallRank: 19, offRating: 125.88, offRank: 14, defRating: 98.23, defRank: 24 },
      { date: "2026-01-28", sheetDate: "2026-01-28", record: "17-3", overallRank: 18, offRating: 126.11, offRank: 13, defRating: 98.66, defRank: 27 },
      { date: "2026-02-06", sheetDate: "2026-02-07", record: "17-5", overallRank: 27, offRating: 126.25, offRank: 10, defRating: 100.58, defRank: 43 },
      { date: "2026-02-09", sheetDate: "2026-02-10", record: "17-6", overallRank: 28, offRating: 126.18, offRank: 7, defRating: 101.7, defRank: 53 },
    ],
  },
};
