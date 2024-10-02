import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";
import Header from './components/Layout/Header';
import Nav from "./components/Layout/Nav";
// import Lineups from "./views/Lineups/Lineups";
import LineupRouter from "./views/Lineups/LineupRouter";
import ClutchRouter from './views/Clutch/ClutchRouter';
import GameLineups from './views/Lineups/components/GameLineups';
import SeasonLineups from "./views/Lineups/components/SeasonLineups";
import GameClutch from './views/Clutch/components/GameClutch';
import Home from "./views/Home/Home";
import { views } from './constants/views';
import AlumniRouter from "./views/Alumni/AlmuniRouter";
import { TouchPointsContextProvider } from "./contexts/TouchpointsContext";

export default function App() {
  const navigate = useNavigate();
  function handleNavClick (viewOpt) {
    navigate(viewOpt.route);
  }
  return (
    <TouchPointsContextProvider>
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
            <Route path="clutch" element={<ClutchRouter />}>
              <Route index element={<GameClutch />} />
              <Route path=":name" element={<GameClutch />} />
            </Route>
            <Route path="alumni" element={<AlumniRouter />} ></Route>
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
      </div>
    </TouchPointsContextProvider>
  );
}
