import React, { useState } from 'react';
import LineupRow from './LineupRow';
import { getLineupHash } from '../../../utils/lineupUtils';
import { condenseStints, namesToReadable, getStintsLabel } from '../../../utils/playerLineupUtils';
import LineupStints from './LineupStints';
import Net from '../../../components/Net/Net';
import SortableHeader from '../../../components/SortableHeader/SortableHeader';
import { GAME_SORT_KEYS } from '../../../utils/gameLineupSorters';

export default function LineupTable ({lineups, filterPlayers, summary, onSortClick, currSortKey, currSortDir}) {
  const [showSummary, setShowSummary] = useState(false);
  function handleToggleShow () {
    setShowSummary(!showSummary);
  }
  function renderFilterCount () {
    const names = namesToReadable(filterPlayers);
    const filteredPlayersString = names.join(', ');
    const labelClass = ['lineup-table__count__label', 'ml-xs'];
    if (showSummary) {
      labelClass.push('lineup-table__count__label--open');
    }
    return (
      <div className="lineup-table__filter-count flex-center">
        <h4 className='lineup-table__count mr-s'>
          {`${lineups.length} lineup(s) containing: ${filteredPlayersString}`}
        </h4>
        <button type="button" onClick={handleToggleShow} className="lineup-table__count__btn flex-aic">
          <span className="material-symbols-sharp lineup-table__count__icon">visibility</span>
          <span className={labelClass.join(' ')}>{showSummary ? 'Hide Summary' : 'View Summary'}</span>
        </button>
      </div>
    );
  }
  function renderFilteredSummary () {
    const filterPlayerNeedsSummary = filterPlayers.length < 5 && filterPlayers.length > 0;
    const isMultipleLineup = lineups.length > 1;
    if (!filterPlayerNeedsSummary || !showSummary || !isMultipleLineup) {
      return null;
    }
    const condensedStints = (filterPlayers.length && lineups.length > 1) ? condenseStints(lineups) : [];
    return (
      <div className="lineup-summary flex-c flex-aic">
        <div className="lineup-summary__stats flex-jcc mb-s">
          <div className="lineup-summary__stat">
            <span className="lineup-summary__stat__label">Total Time:</span>
            {summary.mins.toFixed(2)}
          </div>
          <div className="lineup-summary__stat">
            <span className="lineup-summary__stat__label">Net:</span>
            <Net netVal={summary.net} classes="lineup-summary__net"/>
          </div>
          <div className="lineup-summary__stat">
            <span className="lineup-summary__stat__label">Max Net:</span>
            <Net netVal={summary.maxNet} classes="lineup-summary__net"/>
          </div>
          <div className="lineup-summary__stat">
            <span className="lineup-summary__stat__label">Min Net:</span>
            <Net netVal={summary.minNet} classes="lineup-summary__net"/>
          </div>
        </div>
        <div className="lineup-summary__stints-label mb-s">{getStintsLabel(filterPlayers)}</div>
        <LineupStints stints={condensedStints} />
      </div>
    );
  }
  return (
    <div className='lineup-table f1-hide flex-c'>
        {!!filterPlayers?.length && renderFilterCount()}
        {!!filterPlayers?.length && renderFilteredSummary()}
        <div className='lineup-table__legend pb-s'>
          <div className='circle-badge starter-badge mr-xs'>S</div>
          <span className="lineup-table__legend__text mr-s">- Starters</span>
          <div className='circle-badge ender-badge mr-xs'>E</div>
          <span className="lineup-table__legend__text">- End of game lineup</span>
        </div>
        <div className='lineup-table__headers flex-aic'>
          <SortableHeader 
            classes='lr--lineup lineup-header'
            sortDirection={currSortKey === GAME_SORT_KEYS.NAME ? currSortDir : ''}
            sortKey={GAME_SORT_KEYS.NAME}
            onHeaderClick={onSortClick}
          >
              Lineup
          </SortableHeader>
          <SortableHeader 
            classes='lr--time lineup-header f1'
            sortDirection={currSortKey === GAME_SORT_KEYS.MINS ? currSortDir : ''}
            sortKey={GAME_SORT_KEYS.MINS}
            onHeaderClick={onSortClick}
          >
              Total Time
          </SortableHeader>
          <SortableHeader 
            classes='lr--stint-count lineup-header f1'
            sortDirection={currSortKey === GAME_SORT_KEYS.SEEN ? currSortDir : ''}
            sortKey={GAME_SORT_KEYS.SEEN}
            onHeaderClick={onSortClick}
          >
              Times Seen
          </SortableHeader>
          <SortableHeader 
            classes='lr--net lineup-header f1'
            sortDirection={currSortKey === GAME_SORT_KEYS.NET ? currSortDir : ''}
            sortKey={GAME_SORT_KEYS.NET}
            onHeaderClick={onSortClick}
          >
              + / -
          </SortableHeader>
        </div>
        <div className='lineup-table__body f1-scroll'>
          {
            lineups.map((l) => {
            return (<LineupRow lineup={l} key={getLineupHash(l.names)}/>);
            }) 
          }
        </div>
      </div>
  );
};
