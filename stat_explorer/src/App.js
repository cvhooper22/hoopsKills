import { useEffect, useState } from "react";
import genLineupData, { lineupToString } from "./utils/lineupUtils";
import PlayerFilters from "./components/PlayerFilters";

const teams = [
  {
    name: "Idaho State",
    id: "1299924"
  },
  {
    name: "Missouri State",
    id: "1300377"
  },
  {
    name: "Dayton",
    id: "1300383"
  },
  {
    name: "South Dakota",
    id: "1300532"
  },
  {
    name: "UVU",
    id: "1300384"
  }
];

export default function App() {
  const team = "Dayton";
  const teamId = teams.find((t) => t.name === team).id;
  const [lineupData, setLineupData] = useState({
    lineups: {},
    starterHash: ""
  });
  const [players, setPlayers] = useState([]);
  const [filterPlayers, setFilterPlayers] = useState([]);
  const [err, setErr] = useState("");

  function renderLineups() {
    const currentLineupKeys = Object.keys(lineupData.lineups).sort();
    const currentLineups = currentLineupKeys.reduce((agg, key) => {
      const lineup = lineupData.lineups[key];
      let include = true;
      if (filterPlayers.length) {
        include = filterPlayers.every((p) => lineup.includes(p));
      }
      if (include) {
        agg.push(lineup);
      }
      return agg;
    }, []);
    const lineups = currentLineups.map((l) => {
      return <div style={{ marginBottom: 12 }}>{lineupToString(l)}</div>;
    });
    return (
      <div>
        {!!filterPlayers.length && (
          <div>{`Filtered total: ${lineups.length}`}</div>
        )}
        <div>{lineups}</div>
      </div>
    );
  }

  function onPlayerChange(player) {
    console.log("the player changed", player);
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
    fetch(`https://gamestats.byucougars.com/boxscore/${teamId}`)
      .then((resp) => {
        return resp.json();
      })
      .then((data) => {
        console.log("data is fetched, call it");
        const lineups = genLineupData(data[0].bbgame);
        const team = data[0].bbgame.team.find((t) => t.name === "BYU");
        const players = team.player.map((p) => p.checkname);
        setPlayers(players);
        setLineupData(lineups);
      })
      .catch((err) => {
        setErr(err.toString());
      });
  }, []);
  const loading = Object.keys(lineupData ?? {}).length === 0 && !err;
  return (
    <div className="App">
      {loading && "Loading"}
      {!loading && (
        <PlayerFilters
          players={players}
          filterPlayers={filterPlayers}
          onChange={onPlayerChange}
        />
      )}
      {!loading && Object.keys(lineupData.lineups).length && (
        <div>
          <h2>{team}</h2>
          <h4>{`Total Lineups: ${Object.keys(lineupData.lineups).length}`}</h4>
          <h5>Starters</h5>
          <div style={{ marginBottom: 48, borderBottom: "1px solid" }}>
            {lineupToString(lineupData.lineups[lineupData.starterHash])}
          </div>
          <div>{renderLineups()}</div>
        </div>
      )}
    </div>
  );
}
