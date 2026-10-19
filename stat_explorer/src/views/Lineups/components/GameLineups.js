import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import genLineupData from "../../../utils/lineupUtils";
import playsToBbgame from "../../../utils/playsToBbgame";
import PlayerFilters from "../../../components/PlayerFilters/PlayerFilters";
import "../Lineups.css";
import LineupTable from "./LineupTable";
import TopCombos from "./TopCombos";
import YBallLoader from "../../../components/Loaders/YBballLoader";
import urls from "../../../constants/assetUrls";
import { GAME_CUSTOM_SORTERS, GAME_SORT_KEYS } from "../../../utils/gameLineupSorters";
import { SORT_KEYS } from "../../../constants/sorting";
import { makeSortAscByKey, makeSortDescByKey } from "../../../utils/lineupSorters";

// The filters and the lineup table for one game's plays. Shared by the game page below and the in-game page
// (views/Box/LiveBox.js), which passes plays that are still arriving: everything is derived from `plays`, so a new
// array re-derives the lineups.
export function LineupsPanel({ plays, topCombos = false }) {
  const [currSort, setCurrSort] = useState({key: GAME_SORT_KEYS.NET, direction: SORT_KEYS.DESC});
  const [filterPlayers, setFilterPlayers] = useState([]);

  const derived = useMemo(() => {
    try {
      const bbgame = playsToBbgame(plays);
      const lineupData = genLineupData(bbgame);
      const team = bbgame.team.find((t) => t.name === "BYU");
      const players = team.player.filter(p => p.checkname !== 'TEAM' && p.gp !== "0").map((p) => p.checkname);
      return { lineupData, players };
    } catch (err) {
      console.error(err);
      return { error: true };
    }
  }, [plays]);

  function onPlayerChange(player) {
    const newFilters = [...filterPlayers];
    if (filterPlayers.includes(player)) {
      const playerIndex = newFilters.findIndex((p) => p === player);
      newFilters.splice(playerIndex, 1);
    } else {
      newFilters.push(player);
    }
    setFilterPlayers(newFilters);
  }

  function handleSortClick(newKey, newDir) {
    setCurrSort({
      key: newDir.length ? newKey : '',
      direction: newDir
    })
  };

  const { lineupData, players } = derived;
  const currentLineupData = useMemo(() => {
    if (!lineupData) return { lineups: [], summary: {} };
    const currentLineupKeys = Object.keys(lineupData.lineups).sort();
    const filteredLineupData = currentLineupKeys.reduce((agg, key) => {
        const lineup = lineupData.lineups[key];
        let include = true;
        if (filterPlayers.length) {
          include = filterPlayers.every((p) => lineup.names.includes(p));
        }
        if (include) {
          agg.lineups.push(lineup);
          if (filterPlayers.length) {
            agg.summary.net = agg.summary.net + lineup.totalNet;
            agg.summary.mins = agg.summary.mins + lineup.totalTime;
            if (lineup.totalNet > agg.summary.maxNet) {
                agg.summary.maxNet = lineup.totalNet;
            } else if (lineup.totalNet < agg.summary.minNet) {
                agg.summary.minNet = lineup.totalNet;
            }
          }
        }
        return agg;
      }, { lineups: [], summary: { net: 0, mins: 0, maxNet: 0, minNet: 300}});
    let sortedLineups = filteredLineupData.lineups;
    if (currSort.key) {
      const sortConfig = GAME_CUSTOM_SORTERS[currSort.key];
      let sortLineups = [...sortedLineups];
      if (sortConfig?.dataMapper) {
        sortLineups = sortLineups.map(sortConfig.dataMapper);
      }
      const sorter = currSort.direction === SORT_KEYS.ASC ? makeSortAscByKey(currSort.key) : makeSortDescByKey(currSort.key);
      sortedLineups = sortLineups.sort(sorter);
    }
    return {
      lineups: sortedLineups,
      summary: filteredLineupData.summary,
    };
  }, [lineupData, filterPlayers, currSort.key, currSort.direction]);

  if (derived.error) return <div className="mt-l">These plays can't be turned into lineups yet (no starting lineup in the data).</div>;
  return (
    <div className="f1-hide flex-c">
      <PlayerFilters
        players={players}
        filterPlayers={filterPlayers}
        onChange={onPlayerChange}
      />
      {topCombos && filterPlayers.length < 1 && <TopCombos lineups={Object.values(lineupData.lineups)} />}
      {filterPlayers.length < 1 && <h4 className="lineups__totals">{`Total Lineups: ${currentLineupData.lineups.length}`}</h4>}
      <LineupTable
          summary={currentLineupData.summary}
          lineups={currentLineupData.lineups}
          filterPlayers={filterPlayers}
          onSortClick={handleSortClick}
          currSortKey={currSort.key}
          currSortDir={currSort.direction}
      />
    </div>
  );
}

export default function Lineups() {
  const {name} = useParams();
  const gameId = name;
  const [plays, setPlays] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setPlays(null);
    setMeta(null);
    fetch(urls.pbpGame(gameId))
      .then((resp) => resp.json())
      .then((data) => {
        setPlays(data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        setError(true);
        console.error(err);
      });
    // header team names are optional: the page still works from the plays alone
    fetch(urls.pbpGameMeta(gameId))
      .then((resp) => (resp.ok ? resp.json() : null))
      .then(setMeta)
      .catch(() => setMeta(null));
  }, [gameId]);

  const title = meta ? `${meta.teams[meta.homeId]?.name ?? ''} vs ${meta.teams[meta.awayId]?.name ?? ''}` : '';
  return (
    <>
        <h1 className="lineup-game-label">{title}</h1>
        {loading && <YBallLoader />}
        { !loading && error && <div className="mt-l">There was an error fetching the play by play data</div>}
        {!loading && !error && plays && <LineupsPanel plays={plays} />}
    </>
  );
}
