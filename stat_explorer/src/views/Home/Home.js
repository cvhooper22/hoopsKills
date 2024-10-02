import React from 'react';
import "./Home.css";
import urls from '../../constants/assetUrls';

export default function Home () {
  return (
    <div className="home flex-c scroll">
      <div className="home-content flex flex-c f1">
        <div className="feature-area my-m">
          <img className="home-image" src="lineupsScreen.png" alt="Screenshot of Lineup Page"/>
          <div className="home-description">
            <h2>Lineups</h2>
            Look at each game's lineup, filter by players, and view statistics on how long each lineup played and when.
            <a href="/lineups/season" className='home-link'>
              Go to Lineups
            </a>
          </div>
        </div>
        <div className="feature-area feature-area--description-left my-m">
          <img className="home-image" src={`${urls.assetBase}/assets/images/alumniCards.png`} alt="Screenshot of Lineup Page"/>
          <div className="home-description">
            <h2>Alumni</h2>
            Catch up on where recent BYU Basketball Alumni are currently playing in the pros.
            <a href="/alumni" className='home-link'>
              Check it out
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}