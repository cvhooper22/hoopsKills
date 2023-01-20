import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";
import Header from './components/Layout/Header';
import Nav from "./components/Layout/Nav";
// import Lineups from "./views/Lineups/Lineups";
import LineupRouter from "./views/Lineups/LineupRouter";
import GameLineups from './views/Lineups/components/GameLineups';
import SeasonLineups from "./views/Lineups/components/SeasonLineups";
import Home from "./views/Home/Home";
import { views } from './constants/views';

export default function App() {
  const navigate = useNavigate();
  function handleNavClick (viewOpt) {
    navigate(viewOpt.route);
  }
  return (
    <div className="flex-c App">
      <div className="top-bar">
        <Header />
        <Nav options={views} onOptionClick={handleNavClick}/>
      </div>
      <div className="content">
        <Routes>
          <Route index element={<Home />} />
          <Route path="lineups" element={<LineupRouter />}>
            <Route index element={<GameLineups />} />
            <Route path=":name" element={<GameLineups />} />
            <Route path="season" element={<SeasonLineups /> } />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </div>
  );
}
