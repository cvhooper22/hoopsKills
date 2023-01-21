import React from 'react';
import { numberToGameTime } from '../../../utils/lineupUtils';

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

export default function LineupStints ({stints}) {
    const stintsByPeriod = stints.reduce((agg, stint) => {
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
    return (
        <div className="stint-list">
            {stintsByPeriod.map((s, idx) => {
            if (!s.stints.length) {
              return null;
            }
            return (
              <div className='stint mx-l' key={`stint${idx}`}>
                <div className="stint-title">{indexToLabel[idx]}</div>
                <div className="stint-list">
                  {s.stints.map((st, idx) => {
                    const stintNetClass = ['lr--net stint-net'];
                    if (st.net !== 0) {
                      if (st.net < 0) {
                        stintNetClass.push('lr--net--neg');
                      } else {
                        stintNetClass.push('lr--net--pos');
                      }
                    }
                    return (
                      <div className="lineup-stint" key={`stint${idx}`}>
                        {`${numberToGameTime(st.start, false)} to ${numberToGameTime(st.end, false, st.isEndPeriod)}`}
                        <span className={stintNetClass.join(' ')}>({st.net})</span>
                      </div>
                    );
                  }
                  )}
                </div>
              </div>
            );
          })}
        </div>
    );
};
