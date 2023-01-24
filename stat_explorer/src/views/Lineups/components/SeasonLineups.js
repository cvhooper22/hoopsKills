import { useEffect, useState } from "react";
import PlayerFilters from "../../../components/PlayerFilters/PlayerFilters";
import "../Lineups.css";
import SeasonLineupTable from "./SeasonLineupTable";
import BlockFaceLoader from '../../../components/Loaders/BlockFaceLoader';
import urls from '../../../constants/assetUrls';
import {checknames} from '../../../constants/playerInfo';

export default function SeasonLineups() {
  const [loading, setLoading] = useState(true);
  const players = checknames;
  // console.log('players', players);
  const [filterPlayers, setFilterPlayers] = useState([]);
  const [lineupData, setLineupData] = useState({});
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
      .catch((callErr) => {
        setLoading(false);
        console.error(callErr);
      });
  }, []);
  const currentLineupKeys = Object.keys(lineupData).sort();
  // console.log('currentLineupKey', currentLineupKeys);
  const filteredLineups = currentLineupKeys.reduce((agg, key) => {
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
  // console.log('filteredLineups', filteredLineups);
  const currentLineups = filteredLineups.lineups.sort((lA, lB) => lB.totalMinutes - lA.totalMinutes);
  // console.log('currentLineups', currentLineups);
  return (
    <>
        <h1 className="lineup-game-label">Season Lineups</h1>
        <PlayerFilters
          players={players}
          filterPlayers={filterPlayers}
          onChange={onPlayerChange}
        />
        {loading && <BlockFaceLoader />}
        {!loading && currentLineupKeys.length && (
          <div className="f1-hide flex-c">
            {filterPlayers.length < 1 && <h4 className="lineups__totals">{`Total Lineups: ${currentLineupKeys.length}`}</h4>}
            <SeasonLineupTable summary={filteredLineups.summary} lineups={currentLineups} filterPlayers={filterPlayers}/>
          </div>
        )}
    </>
  );
}
