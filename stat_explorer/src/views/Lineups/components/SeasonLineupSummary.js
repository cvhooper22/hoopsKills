import React from 'react';

export default function SeasonLineupSummary () {
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
};
