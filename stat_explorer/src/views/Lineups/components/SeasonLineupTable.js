import React from 'react';
import SeasonLineupRow from './SeasonLineupRow';
import { getLineupHash } from '../../../utils/lineupUtils';
import { namesToReadable } from '../../../utils/playerLineupUtils';

export default function LineupTable ({lineups, filterPlayers}) {
  function renderFilterCount () {
    const names = namesToReadable(filterPlayers);
    const filteredPlayersString = names.join(', ');
    return <h4 className='lineup-table__count'>{`${lineups.length} lineup(s) containing: ${filteredPlayersString}`}</h4>
  }
  return (
    <div className='lineup-table f1-hide flex-c'>
        {!!filterPlayers?.length && renderFilterCount()}
        <div className='lineup-table__headers py-m flex-aic'>
          <div className='lr--lineup lineup-header'>Lineup</div>
          <div className='lr--time lineup-header f1'>Total Time</div>
          <div className='lr--stint-count lineup-header f1'>Min / g</div>
          <div className='lr--net lineup-header f1'>+ / -</div>
        </div>
        <div className='lineup-table__body f1-scroll'>
          {
            lineups.map((l) => <SeasonLineupRow lineup={l} key={getLineupHash(l.names)}/>)
          }
        </div>
      </div>
  );
};
