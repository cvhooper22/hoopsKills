import { useState } from "react";
import "./App.css";
import Header from './components/Layout/Header';
import Nav from "./components/Layout/Nav";
import Lineups from "./views/Lineups/Lineups";
import Home from "./views/Home/Home";
import { HOME_VIEW, LINEUP_VIEW, KILLS_VIEW, CLUTCH_VIEW } from "./constants/views";

const views = [
  {
    title: HOME_VIEW,
  },
  {
    title: LINEUP_VIEW,
  },
  {
    title: KILLS_VIEW,
    disabled: true,
  },
  {
    title: CLUTCH_VIEW,
    disabled: true,
  } 
];

export default function App() {
  const [currentView, setCurrentView] = useState(HOME_VIEW);
  function handleViewClick (view) {
    console.log('set surrent view!', view);
    setCurrentView(view);
  }
  return (
    <div className="flex-c App">
      <div className="top-bar">
        <Header />
        <Nav options={views} onOptionClick={handleViewClick} currentOption={currentView}/>
      </div>
      <div className="content">
        { currentView === LINEUP_VIEW && <Lineups />}
        { currentView === HOME_VIEW && <Home />}
      </div>
    </div>
  );
}
