import React, { useState } from 'react';
import { lineupToString, getLineupHash } from '../../../utils/lineupUtils';
import { gameNameToUrl } from '../../../constants/games';

export default function SeasonLineupRow ({lineup}) {
  const [showGgames, setshowGgames] = useState(false);
  const hash = getLineupHash(lineup.names);
  
  function handleTriggerClick () {
    setshowGgames(!showGgames);
  }
  const netClass = ['lr--net', 'f1'];
  if (lineup.totalNet !== 0) {
    if (lineup.totalNet < 0) {
      netClass.push('lr--net--neg');
    } else {
      netClass.push('lr--net--pos');
    }
  }
  const avgMins = lineup.totalMinutes / lineup.games.length;
  return(
    <div className="lineup-row" key={hash}>
      <div className='flex-aic pt-s'>
        <div className='lr--lineup flex-center'>
          {lineupToString(lineup)}
        </div>
        <div className="lr--time f1">{lineup.totalMinutes.toFixed(2)}</div>
        <div className='lr--stint-count f1'>{avgMins.toFixed(2)}</div>
        <div className={netClass.join(' ')}>{lineup.totalNet}</div>
      </div>
      <div className="lineup-stints mt-s pb-s px-l">
        <div className='trigger-row flex-jce' role="button" onClick={handleTriggerClick}>
          <span className="trigger-text mr-s">{`${showGgames ? 'Hide' : 'View'} Games`}</span>
          <div className={`trigger${showGgames ? ' trigger--open' : ''}`} />
        </div>
        <div className={`flex-c lineup-stints-container${showGgames ? ' lineup-stints-container--open pb-s mt-s' : ''}`}>
          <div className="lineup-games flex-jce">
            {lineup.games.map((s, idx) => {
              const gameNetClass = ['game__net'];
              if (s.net !== 0) {
                if (s.net < 0) {
                  gameNetClass.push('game__net--neg');
                } else {
                  gameNetClass.push('game__net--pos');
                }
              }
              const gameClass = ['game flex-aic mr-m'];
              if (s.name.includes('(N)')) {
                gameClass.push('game--neutral')
              }
              if (s.name.includes('(A)')) {
                gameClass.push('game--away')
              }
              const url = gameNameToUrl[s.name];
              return (
                <div className={gameClass.join(' ')} key={`${hash}${s.name}`}>
                  <div className="game__img-container mr-xs"><img src={url} className='game__logo' title={`${s.name} - ${s.mins ? s.mins.toFixed(2) : ''}`} alt={`Logo for ${s.name}`}/></div>
                  <span className={gameNetClass.join(' ')}>{s.net}</span>
                </div>
              );
            })}
          </div>
          <div className="lineup-game-legend flex-jce mt-s mr-s">
            <div className="game-legend__away flex-aic mr-s">
              <div className="game-legend__indicator mr-xs" />
              Away
            </div>
            <div className="game-legend__neutral flex-aic">
              <div className="game-legend__indicator mr-xs" />
              Neutral
            </div>
          </div>
        </div>
      </div>
    </div>
  )
};
