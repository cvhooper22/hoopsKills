import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import games from '../../constants/games';
import "./GameSelector.css";

export default function GameSelector () {
  const location = useLocation();
  const pathname = location.pathname;
  return (
    <div className='games flex-c mr-l scroll'>
      <div className="games__broad-selectors">
        <Link to="/lineups/season" className="game-link">
          <div className={`game-row flex-aic${pathname === '/lineups/season' ? ' game-row--selected' : ''}`} key="season-selector">
            <span className='game-oponent ml-s'>Season</span>
          </div>
        </Link>
      </div>
      { games.map(g => {
        const isCurrent = location.pathname === `/lineups/${g.path}`;
        return (
          <Link to={g.path} className="game-link" key={g.id}>
            <div className={`game-row flex-aic${isCurrent ? ' game-row--selected' : ''}`}>
              <img src={g.imageSrc} className='game-logo' alt={`Logo for ${g.name}`}/>
              <span className='game-oponent ml-s'>{g.name}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
