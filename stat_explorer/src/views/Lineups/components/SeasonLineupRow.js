import React, { useState } from 'react';
import { lineupToString, getLineupHash } from '../../../utils/lineupUtils';

export default function LineupRow ({lineup}) {
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
  return(
    <div className="lineup-row" key={hash}>
      <div className='flex-aic pt-s'>
        <div className='lr--lineup flex-center'>
          {lineupToString(lineup)}
        <div className="lr--time f1">{lineup.totalTime.toFixed(2)}</div>
        <div className='lr--stint-count f1'>{lineup.stints.length}</div>
        <div className={netClass.join(' ')}>{lineup.totalNet}</div>
      </div>
      <div className="lineup-stints mt-s pb-s px-l">
        <div className='trigger-row flex-jce' role="button" onClick={handleTriggerClick}>
          <span className="trigger-text mr-s">{`${showGgames ? 'Hide' : 'View'} Games`}</span>
          <div className={`trigger${showGgames ? ' trigger--open' : ''}`} />
        </div>
        <div className={`flex-jce lineup-stints-container${showGgames ? ' lineup-stints-container--open py-s mt-s' : ''}`}>
          {lineup.games.map((s, idx) => {
            if (!s.stints.length) {
              return null;
            }
            return (
              <div className='stint mx-l' key={`${hash}_games${idx}`}>
                  {lineup.games.map((st, idx) => (<div className="lineup-stint" key={`${hash}${st}`}>{st}</div>))}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  )
};
