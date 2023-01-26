import { getLineupHash } from "./lineupUtils";

export const SEASON_SORT_KEYS ={
    NAME: 'name',
    MINS: 'totalMinutes',
    NET: 'totalNet',
    AVG: 'avg'
};

export const SEASON_CUSTOM_SORTERS = {
    [SEASON_SORT_KEYS.NAME]: {
        dataMapper: (lineup) => {
            return { ...lineup, [SEASON_SORT_KEYS.NAME]: getLineupHash(lineup.names)};
        }
    },
    [SEASON_SORT_KEYS.AVG]: {
        dataMapper: (lineup) => {
            return { ...lineup, [SEASON_SORT_KEYS.AVG]: lineup.totalMinutes / lineup.games.length };
        }
    }
};