import { useEffect, useState } from "react";
import genLineupData from "../../utils/lineupUtils";
import PlayerFilters from "../../components/PlayerFilters/PlayerFilters";
import "./Lineups.css";
import LineupTable from "./components/LineupTable";
import YBallLoader from "../../components/Loaders/YBballLoader";
import GameSelector from "../../components/GameSelector/GameSelector";
import { nameFromId } from '../../constants/games';
import { condenseStints } from "../../utils/playerLineupUtils";

export default function Lineups() {
  const [lineupData, setLineupData] = useState({
    lineups: {},
    starterHash: ""
  });
  const [currentGame, setCurrentGame] = useState("1300216");
  const [players, setPlayers] = useState([]);
  const [filterPlayers, setFilterPlayers] = useState([]);
  const [err, setErr] = useState("");

  function handleGameChange (gameId) {
    if (gameId) {
      setCurrentGame(gameId);
      setLineupData({
        lineups: {},
        starterHash: ""
      });
    }
  }

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
      })
      .catch((err) => {
        setErr(err.toString());
      });
  }, [currentGame]);
  const currentLineupKeys = Object.keys(lineupData.lineups).sort();
  const filteredLineups = currentLineupKeys.reduce((agg, key) => {
    const lineup = lineupData.lineups[key];
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
  const loading = Object.keys(lineupData.lineups).length === 0 && !err;
  const condensedStints = currentLineups.length > 1 ? condenseStints(currentLineups) : [];
  console.log('condensedStints: ', condensedStints);
  return (
    <div className="lineups flex">
      <GameSelector onGameClick={handleGameChange} currentGame={currentGame}/>
      <div className="lineups-content f1 flex-c pr-l">
        <h1 className="lineup-game-label">{nameFromId(currentGame)}</h1>
        {loading && <YBallLoader />}
        {!loading && !!Object.keys(lineupData.lineups).length && (
          <div className="f1-hide flex-c">
            <PlayerFilters
              players={players}
              filterPlayers={filterPlayers}
              onChange={onPlayerChange}
            />
            {filterPlayers.length < 1 && <h4 className="lineups__totals">{`Total Lineups: ${Object.keys(lineupData.lineups).length}`}</h4>}
            <LineupTable lineups={currentLineups} filterPlayers={filterPlayers}/>
          </div>
        )}
      </div>
    </div>
  );
}
