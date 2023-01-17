import { useEffect, useState } from "react";
import genLineupData, { lineupToString, numberToGameTime } from "../../utils/lineupUtils";
import PlayerFilters from "./PlayerFilters/PlayerFilters";
// import "./Lineups.css";
import SeasonLineupTable from "./LineupTable";
import BlockFacecLoader from "./Loaders/BlockFacecLoader";
import { nameFromId } from '../../constants/games';
import urls from '../../../constants/assetUrls';
import playerInfo from '../../../constants/playerInfo';

export default function SeasonLineups() {
  const [loading, setLoading] = useState(true);
  const players = Object.keys(playerInfo);
  const [filterPlayers, setFilterPlayers] = useState([]);
  const [err, setErr] = useState("");

  // function handleGameChange (gameId) {
  //   if (gameId) {
  //     setCurrentGame(gameId);
  //     setLineupData({
  //       lineups: {},
  //       starterHash: ""
  //     });
  //   }
  // }

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

  useEffect(() => {
    fetch(urls.seasonLineups)
      .then((resp) => {
        return resp.json();
      })
      .then((data) => {
        const lineups = data;
        setLoading(false);
        setLineupData(lineups);
      })
      .catch((err) => {
        setLoading(false);
        setErr(err.toString());
      });
  }, [currentGame]);
  const currentLineupKeys = Object.keys(lineupData).sort();
  const filteredLineups = currentLineupKeys.reduce((agg, key) => {
    const lineup = lineupData[key];
    let include = true;
    if (filterPlayers.length) {
      include = filterPlayers.every((p) => lineup.names.includes(p));
    }
    if (include) {
      agg.push(lineup);
    }
    return agg;
  }, []);
  const currentLineups = filteredLineups.sort((lA, lB) => lB.totalTime - lA.totalTime);
  return (
    <div className="lineups flex">
      <GameSelector onGameClick={handleGameChange} currentGame={currentGame}/>
      <div className="lineups-content f1 flex-c pr-l">
        <h1 className="lineup-game-label">{nameFromId(currentGame)}</h1>
        {loading && <BlockFacecLoader />}
        {!loading && !!Object.keys(lineupData.lineups).length && (
          <div className="f1-hide flex-c">
            <PlayerFilters
              players={players}
              filterPlayers={filterPlayers}
              onChange={onPlayerChange}
            />
            {filterPlayers.length < 1 && <h4 className="lineups__totals">{`Total Lineups: ${lineupData.length}`}</h4>}
            <SeasonLineupTable lineups={currentLineups} filterPlayers={filterPlayers}/>
          </div>
        )}
      </div>
    </div>
  );
}
