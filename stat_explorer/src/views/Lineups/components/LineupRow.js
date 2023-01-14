import React, { useState } from 'react';
import { lineupToString, getLineupHash, numberToGameTime } from '../../../utils/lineupUtils';

const postFixToIndex = {
  '2H': 1,
  'OT': 2,
  '2OT': 3,
  '3OT': 4,
  '4OT': 5,
};

const indexToLabel = {
  0: '1st Half',
  1: '2nd Half',
  2: 'Overtime',
  3: '2nd Overtime',
  4: '3rd Overtime',
  5: '4th Overtime'
};

export default function LineupRow ({lineup}) {
  const [showStints, setShowStints] = useState(false);
  const avgStintTime = lineup.totalTime / (lineup.stints?.length ?? 1);
  const stintsByPeriod = lineup.stints.reduce((agg, stint) => {
    const startString = numberToGameTime(stint.start);
    const postFix = startString.split(' ')[1];
    let index = 0;
    if (postFix) {
      index = postFixToIndex[postFix];
    }
    agg[index].stints.push(stint);
    return agg;
  }, [
    {stints: []},
    {stints: []},
    {stints: []},
    {stints: []},
    {stints: []},
    {stints: []}
  ]);
  
  function handleTriggerClick () {
    setShowStints(!showStints);
  }
  return(
    <div className="lineup-row" key={getLineupHash(lineup.names)}>
      <div className='flex-aic pt-s'>
        <div className='lr--lineup flex-center'>
          {lineupToString(lineup)}
          {lineup.isStartingLineup && <div className='circle-badge starter-badge ml-s'>S</div>}
          {lineup.isEndingLineup && <div className='circle-badge ender-badge ml-s'>E</div>}
          </div>
        <div className="lr--time f1">{lineup.totalTime.toFixed(2)}</div>
        <div className='lr--stint-count f1'>{lineup.stints.length}</div>
        <div className='lr--avg-time f1'>{avgStintTime.toFixed(2)}</div>
      </div>
      <div className="lineup-stints mt-s pb-s px-l">
        <div className='trigger-row flex-jce' role="button" onClick={handleTriggerClick}>
          <span className="trigger-text mr-s">{`${showStints ? 'Hide' : 'View'} Stints`}</span>
          <div className={`trigger${showStints ? ' trigger--open' : ''}`} />
        </div>
        <div className={`flex-jce lineup-stints-container${showStints ? ' lineup-stints-container--open py-s mt-s' : ''}`}>
          {stintsByPeriod.map((s, idx) => {
            if (!s.stints.length) {
              return null;
            }
            return (
              <div className='stint mx-l' key={`stint${idx}`}>
                <div className="stint-title">{indexToLabel[idx]}</div>
                <div className="stint-list">
                  {s.stints.map((st, idx) => (<div className="lineup-stint" key={`stint${idx}`}>{`${numberToGameTime(st.start, false)} to ${numberToGameTime(st.end, false, st.isEndPeriod)}`}</div>))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  )
};
