// Every stop type the kill detector (src/utils/kills.js) can produce, in a
// fixed display order. Kept as its own file, separate from killInsights.js,
// so the full list can be referenced anywhere — a legend, a filter, a chart —
// without pulling in the rest of the derivation layer.
//
// "rebound" means an uncredited defensive rebound; a block that led directly
// to one is its own "block" type (see kills-rules.md), which is why a block
// isn't folded into rebounds. "tie_up" is a held ball the defense forced that
// switched possession (see kills-rules.md).
export const STOP_TYPES = [
  { type: 'rebound', letter: 'R', label: 'Def. rebounds', name: 'defensive rebound' },
  { type: 'turnover', letter: 'T', label: 'Turnovers', name: 'turnover' },
  { type: 'steal', letter: 'S', label: 'Steals', name: 'steal' },
  { type: 'block', letter: 'B', label: 'Blocks', name: 'block' },
  { type: 'charge', letter: 'C', label: 'Charges', name: 'charge' },
  { type: 'tie_up', letter: 'H', label: 'Tie-ups', name: 'tie-up' },
];

export const STOP_TYPE_LETTER = Object.fromEntries(STOP_TYPES.map((t) => [t.type, t.letter]));
export const STOP_TYPE_LABEL = Object.fromEntries(STOP_TYPES.map((t) => [t.type, t.label]));
// Singular, lowercase — for inline text and tooltips (e.g. "not in your marks · steal").
export const STOP_TYPE_NAME = Object.fromEntries(STOP_TYPES.map((t) => [t.type, t.name]));
