import { useMemo } from 'react';
import { buildLineupModel } from '../../utils/lineupModel';
import { lineupStints } from '../../utils/lineupTimeline';

// One lineup model per payload, shared by the lineup tabs. `model` is null for a box file without events or lineups, and then
// `stintsFor` and `luOf` fall back to the per-chance snapshots (start-of-chance, so edges are only as exact as the chances).
export default function useLineupModel(data) {
  return useMemo(() => {
    const model = buildLineupModel(data.events, data.plays);
    return {
      model,
      stintsFor: (side) => (model ? model.stints(side) : lineupStints(data.plays, side)),
      luOf: model ? (p, side) => model.lineupOfPlay(side, p) : undefined,
    };
  }, [data.events, data.plays]);
}
