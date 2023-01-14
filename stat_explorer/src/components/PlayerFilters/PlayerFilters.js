import react, { useState } from "react";
import playerInfo from '../../constants/playerInfo';
import urls from "../../constants/assetUrls";
import './PlayerFilters.css';

export default function PlayerFilters({ players, filterPlayers, onChange }) {
  function getCheckboxHandler(player) {
    return () => {
      if (onChange) {
        onChange(player);
      }
    };
  }

  // const { selected, unselected} = players.reduce((agg, p) => {
  //   if (filterPlayers.includes(p)) {
  //     agg.selected.push(p);
  //   } else {
  //     agg.unselected.push(p);
  //   }
  //   return agg;
  // }, {selected: [], unselected: []});
  // const displayPlayers = [...selected, ...unselected];
  return (
    <div className="player-filter flex-center">
      <h4 className="player-filter__title">Filter by player</h4>
      <div className="player-filters">
        {players.map((p) => {
          const firstName = p.split(",")[1];
          const lastName = p.split(",")[0];
          const info = playerInfo[firstName + lastName];
            const isChecked = filterPlayers.includes(p);
            const imageUrl = `${urls.espnPhotoStart}${info?.id}${urls.espnPhotoEnd}`;
            return (
                <div className="player" role="button" onClick={getCheckboxHandler(p)} key={p}>
                  <img className={isChecked ? 'active' : ''} src={imageUrl} />
                  <div className="player__number">
                    {`#${info?.no}`}
                  </div>
                </div>
            );
          })}
      </div>
    </div>
  );
}
