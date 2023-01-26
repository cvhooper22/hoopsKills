import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import genLineupData from "../../../utils/lineupUtils";
import PlayerFilters from "../../../components/PlayerFilters/PlayerFilters";
import "../Lineups.css";
import LineupTable from "./LineupTable";
import YBallLoader from "../../../components/Loaders/YBballLoader";
import { nameFromId, idFromPath } from '../../../constants/games';
import { GAME_CUSTOM_SORTERS, GAME_SORT_KEYS } from "../../../utils/gameLineupSorters";
import { SORT_KEYS } from "../../../constants/sorting";
import { makeSortAscByKey, makeSortDescByKey } from "../../../utils/lineupSorters";

export default function Lineups() {
  const {name} = useParams();
  const [lineupData, setLineupData] = useState({
    lineups: {},
    starterHash: ""
  });
  const [loading, setLoading] = useState(true);
  const [currSort, setCurrSort] = useState({key: GAME_SORT_KEYS.NET, direction: SORT_KEYS.DESC});
  const initialId = idFromPath(name);
  const [currentGame, setCurrentGame] = useState(initialId ?? "1300217");
  const [players, setPlayers] = useState([]);
  const [filterPlayers, setFilterPlayers] = useState([]);

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
    const newGameId = idFromPath(name);
    if (newGameId !== currentGame) {
        setLoading(true);
        setCurrentGame(newGameId);
    }
  }, [name, currentGame]);

  useEffect(() => {
    fetch(`https://gamestats.byucougars.com/boxscore/${currentGame}`)
      .then((resp) => {
        return resp.json();
      })
      .then((data) => {
        const lineups = genLineupData(data[0].bbgame);
        const team = data[0].bbgame.team.find((t) => t.name === "BYU");
        const teamPlayers = team.player.filter(p => p.checkname !== 'TEAM' && p.gp !== "0");
        const players = teamPlayers.map((p) => p.checkname);
        setPlayers(players);
        setLineupData(lineups);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
      });
  }, [currentGame]);

  const lineupCount = Object.keys(lineupData).length;
  const currentLineupData = useMemo(() => {
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
  }, [filterPlayers.length, lineupCount, currSort.key, currSort.direction]);
  return (
    <>
        <h1 className="lineup-game-label">{nameFromId(currentGame)}</h1>
        {loading && <YBallLoader />}
        {!loading && (
          <div className="f1-hide flex-c">
            <PlayerFilters
              players={players}
              filterPlayers={filterPlayers}
              onChange={onPlayerChange}
            />
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
        )}
    </>
  );
}
