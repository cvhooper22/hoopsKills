import React from 'react';
import "./Home.css";

export default function Home () {
  return (
    <div className="home">
      <div className="feature-area my-m">
        <img className="home-image" src="lineupsScreen.png" alt="Screenshot of Lineup Page"/>
        <div className="home-lineups">
          <h2>Lineups</h2>
          Look at each game's lineup, filter by players, and view statistics on how long each lineup played and when.
        </div>
      </div>
    </div>
  );
}