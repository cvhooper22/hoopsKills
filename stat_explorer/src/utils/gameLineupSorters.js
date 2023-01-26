import { getLineupHash } from "./lineupUtils";

export const GAME_SORT_KEYS ={
    NAME: 'name',
    MINS: 'totalTime',
    NET: 'totalNet',
    SEEN: 'timesSeen'
};

export const GAME_CUSTOM_SORTERS = {
    [GAME_SORT_KEYS.NAME]: {
        dataMapper: (lineup) => {
            return { ...lineup, [GAME_SORT_KEYS.NAME]: getLineupHash(lineup.names)};
        }
    },
    [GAME_SORT_KEYS.SEEN]: {
        dataMapper: (lineup) => {
            return { ...lineup, [GAME_SORT_KEYS.SEEN]: lineup.stints.length };
        }
    }
};