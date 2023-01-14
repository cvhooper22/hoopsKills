import React from 'react';
import "./Home.css";

export default function Home () {
  return (
    <div className="home">
      <p className="feature-area">
        <img className="home-image" src="lineupsScreen.png"/>
        <div className="home-lineups">
          <h2>Lineups</h2>
          Look at each game's lineup, filter by players, and view statistics on how long each lineup played and when.
        </div>
      </p>
    </div>
  );
}