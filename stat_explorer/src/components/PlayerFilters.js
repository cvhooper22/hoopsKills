import react, { useState } from "react";

export default function PlayerFilters({ players, filterPlayers, onChange }) {
  function getCheckboxHandler(player) {
    return () => {
      if (onChange) {
        onChange(player);
      }
    };
  }

  return (
    <div>
      {players.map((p) => {
        const firstName = p.split(",")[1];
        const lastName = p.split(",")[0];
        const isChecked = filterPlayers.includes(p);
        return (
          <span>
            <input
              type="checkbox"
              id={p}
              checked={isChecked}
              onChange={getCheckboxHandler(p)}
            />
            <label for={p}>{`${firstName} ${lastName}`}</label>
          </span>
        );
      })}
    </div>
  );
}
