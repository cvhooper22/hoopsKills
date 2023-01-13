import React from 'react';
import games from '../../constants/games';
import "./GameSelector.css";

export default function GameSelector ({onGameClick, currentGame}) {
  function makeClickHandler (gameId) {
    return () => {
      if (onGameClick) {
        onGameClick(gameId);
      }
    }
  }
  return (
    <div className='games flex-c mr-l scroll'>
      { games.map(g => {
        return (
          <div className={`game-row flex-aic${currentGame === g.id ? ' game-row--selected' : ''}`} role="button" onClick={makeClickHandler(g.id)} key={g.id}>
            <img src={g.imageSrc} className='game-logo' />
            <span className='game-oponent ml-s'>{g.name}</span>
          </div>
        );
      })}
    </div>
  );
};
