import React, {useState} from 'react';
import SeasonLineupRow from './SeasonLineupRow';
import { getLineupHash } from '../../../utils/lineupUtils';
import { namesToReadable, getStintsLabel } from '../../../utils/playerLineupUtils';
import { aggregateGamesForLineups } from '../../../utils/seasonLineups';
import { gameNameToUrl } from '../../../constants/games';
import LineupSummary from './LineupSummary';
import Net from '../../../components/Net/Net';

export default function LineupTable ({lineups, filterPlayers,summary}) {
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
    const allGames = aggregateGamesForLineups(lineups);
    return (
      <div className="lineup-summary flex-c flex-aic">
        <LineupSummary summary={summary} />
        <div className="lineup-summary__stints-label mb-s flex-aic">
          {getStintsLabel(filterPlayers, 'Games')}
        </div>
        <div className="lineup-game-legend flex-jcc">
          <div className="game-legend__away flex-aic mr-s">
            <div className="game-legend__indicator mr-xs" />
            Away
          </div>
          <div className="game-legend__neutral flex-aic">
            <div className="game-legend__indicator mr-xs" />
            Neutral
          </div>
        </div>
        <div className="lineup-games flex-jcc mb-m">
            {allGames.map((g) => {
              const gameClass = ['game flex-aic mr-m pt-s'];
              if (g.name.includes('(N)')) {
                gameClass.push('game--neutral')
              }
              if (g.name.includes('(A)')) {
                gameClass.push('game--away')
              }
              const url = gameNameToUrl[g.name];
              return (
                <div className={gameClass.join(' ')} key={g.name}>
                  <div className="game__img-container mr-xs"><img src={url} className='game__logo' title={g.name} alt={`Logo for ${g.name}`}/></div>
                  <Net classes="game__net" netVal={g.net} />
                </div>
              );
            })}
          </div>
      </div>
    );
  }

  return (
    <div className='lineup-table f1-hide flex-c'>
        {!!filterPlayers?.length && renderFilterCount()}
        {!!filterPlayers?.length && renderFilteredSummary()}
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
