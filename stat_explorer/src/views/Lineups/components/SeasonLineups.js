import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import PlayerFilters from "../../../components/PlayerFilters/PlayerFilters";
import "../Lineups.css";
import SeasonLineupTable from "./SeasonLineupTable";
import BlockFaceLoader from '../../../components/Loaders/BlockFaceLoader';
import urls from '../../../constants/assetUrls';
import { SEASON_CUSTOM_SORTERS, SEASON_SORT_KEYS } from "../../../utils/seasonLineupSorters";
import { SORT_KEYS } from "../../../constants/sorting";
import { makeSortAscByKey, makeSortDescByKey } from "../../../utils/lineupSorters";

export default function SeasonLineups() {
  const [params] = useSearchParams();
  const seasonParam = Number(params.get('season')) || null;
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [filterPlayers, setFilterPlayers] = useState([]);
  const [currSort, setCurrSort] = useState({key: SEASON_SORT_KEYS.NET, direction: SORT_KEYS.DESC});
  const [lineupData, setLineupData] = useState({});
  const [teams, setTeams] = useState(null);
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

  useEffect(() => {
    // the opponent names and logos are optional: the chips fall back to the team ids
    fetch(urls.teamsMeta())
      .then((r) => (r.ok ? r.json() : null))
      .then(setTeams)
      .catch(() => setTeams(null));
    // ?season= from the game picker, else the latest season in the index. The season file keeps
    // per-game info once, so merge it into each lineup's games.
    setLoading(true);
    fetch(urls.lineupsSeasonsIndex())
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((seasons) => fetch(urls.lineupsSeason((seasons.find((s) => s.season === seasonParam) || seasons[0]).season)))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        const lineups = {};
        Object.entries(data.lineups).forEach(([hash, l]) => {
          lineups[hash] = { ...l, games: l.games.map((g) => ({ ...data.games[g.gameId], ...g })) };
        });
        setPlayers(data.players.map((p) => p.name));
        setLoading(false);
        setLineupData(lineups);
      })
      .catch((callErr) => {
        setLoading(false);
        console.error(callErr);
      });
  }, [seasonParam]);

  const lineupCount = Object.keys(lineupData).length;
  const currentLineupData = useMemo(() => {
    const currentLineupKeys = Object.keys(lineupData).sort();
    const filteredLineupData = currentLineupKeys.reduce((agg, key) => {
      const lineup = lineupData[key];
      let include = true;
      if (filterPlayers.length) {
        include = filterPlayers.every((p) => lineup.names.includes(p));
      }
      if (include) {
        agg.lineups.push(lineup);
        if (filterPlayers.length) {
          agg.summary.net = agg.summary.net + lineup.totalNet;
          agg.summary.mins = agg.summary.mins + lineup.totalMinutes;
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
      const sortConfig = SEASON_CUSTOM_SORTERS[currSort.key];
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
  }, [filterPlayers.length, lineupData, currSort.key, currSort.direction]);
  return (
    <>
        <h1 className="lineup-game-label">Season Lineups</h1>
        <PlayerFilters
          players={players}
          filterPlayers={filterPlayers}
          onChange={onPlayerChange}
        />
        {loading && <BlockFaceLoader />}
        {!loading && (
          <div className="f1-hide flex-c">
            {filterPlayers.length < 1 && <h4 className="lineups__totals">{`Total Lineups: ${currentLineupData.lineups.length}`}</h4>}
            <SeasonLineupTable
              teams={teams}
              summary={currentLineupData.summary}
              lineups={currentLineupData.lineups}
              filterPlayers={filterPlayers}
              onSortClick={handleSortClick}
              currSortKey={currSort.key}
              currSortDir={currSort.direction}
            />
          </div>
        )}
    </>
  );
}
