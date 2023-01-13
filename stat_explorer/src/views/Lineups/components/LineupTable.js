import React from 'react';
import LineupRow from './LineupRow';
import { getLineupHash } from '../../../utils/lineupUtils';

export default function LineupTable ({lineups, filterPlayers}) {
  function renderFilterCount () {
    const filteredPlayersString = filterPlayers.toString();
    return <h4 className='lineup-table__count'>{`${lineups.length} lineup(s) containing: ${filteredPlayersString}`}</h4>
  }
  return (
    <div className='lineup-table f1-hide flex-c'>
        {!!filterPlayers?.length && renderFilterCount()}
        <div className='lineup-table__legend pb-s'>
          <div className='circle-badge starter-badge mr-xs'>S</div>
          <span className="lineup-table__legend__text mr-s">- Starters</span>
          <div className='circle-badge ender-badge mr-xs'>E</div>
          <span className="lineup-table__legend__text">- End of game lineup</span>
        </div>
        <div className='lineup-table__headers py-m flex-aic'>
          <div className='lr--lineup lineup-header'>Lineup</div>
          <div className='lr--time lineup-header f1'>Total Time</div>
          <div className='lr--stint-count lineup-header f1'>Times Seen</div>
          <div className='lr--avg-time lineup-header f1'>Avg Stint Time</div>
        </div>
        <div className='lineup-table__body f1-scroll'>
          {
            lineups.map((l) => <LineupRow lineup={l} key={getLineupHash(l.names)}/>)
          }
        </div>
      </div>
  );
};
