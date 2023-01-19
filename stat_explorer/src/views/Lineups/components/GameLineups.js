import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import genLineupData from "../../../utils/lineupUtils";
import PlayerFilters from "../../../components/PlayerFilters/PlayerFilters";
import "../Lineups.css";
import LineupTable from "./LineupTable";
import YBallLoader from "../../../components/Loaders/YBballLoader";
import { nameFromId, idFromPath } from '../../../constants/games';

export default function Lineups() {
  console.log('GameLineups::top');
  const {name} = useParams();
  const [lineupData, setLineupData] = useState({
    lineups: {},
    starterHash: ""
  });
  const [loading, setLoading] = useState(true);
  const initialId = idFromPath(name);
  console.log('\tinitial id is', initialId);
  const [currentGame, setCurrentGame] = useState(initialId ?? "1300215");
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
  return (
    <>
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
    </>
  );
}
