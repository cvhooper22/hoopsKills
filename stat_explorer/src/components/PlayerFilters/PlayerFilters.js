import React, { useState } from "react";
import playerInfo from '../../constants/playerInfo';
import urls from "../../constants/assetUrls";
import './PlayerFilters.css';

function PlayerPhoto({ src, name, initials, active }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`player__initials${active ? ' active' : ''}`} aria-label={name}>
        {initials}
      </div>
    );
  }
  return <img className={active ? 'active' : ''} src={src} alt={name} onError={() => setFailed(true)}/>;
}

export default function PlayerFilters({ players, filterPlayers, onChange, delimiter=','}) {
  function getCheckboxHandler(player) {
    return () => {
      const playerIsFiltered = filterPlayers.includes(player);
      if (onChange && playerIsFiltered) {
        onChange(player);
        return;
      }
      if (onChange && filterPlayers.length < 5) {
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
          const firstName = p.split(delimiter)[1];
          const lastName = p.split(delimiter)[0];
          const info = playerInfo[firstName + lastName];
            const isChecked = filterPlayers.includes(p);
            const imageUrl = info?.id ? `${urls.espnPhotoStart}${info.id}${urls.espnPhotoEnd}` : null;
            const cap = (n = '') => n.trim().toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
            const displayName = `${cap(firstName)} ${cap(lastName)}`.trim();
            const initials = `${(firstName || '').trim()[0] || ''}${(lastName || '').trim()[0] || ''}`.toUpperCase();
            return (
                <div className="player" role="button" title={displayName} onClick={getCheckboxHandler(p)} key={p}>
                  <PlayerPhoto src={imageUrl} name={p} initials={initials} active={isChecked}/>
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
