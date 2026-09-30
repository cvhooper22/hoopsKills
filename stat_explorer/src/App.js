import { lazy, Suspense } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import "./App.css";
import Header from './components/Layout/Header';
import Nav from "./components/Layout/Nav";
// import Lineups from "./views/Lineups/Lineups";
import LineupRouter from "./views/Lineups/LineupRouter";
import ClutchRouter from './views/Clutch/ClutchRouter';
import GameLineups from './views/Lineups/components/GameLineups';
import SeasonLineups from "./views/Lineups/components/SeasonLineups";
import GameClutch from './views/Clutch/components/GameClutch';
import Kills from "./views/Kills/Kills";
import KillsRouter from "./views/Kills/KillsRouter";
import LatestGameRedirect from "./components/GameSwitcher/LatestGameRedirect";
import Home from "./views/Home/Home";
import { views } from './constants/views';
import AlumniRouter from "./views/Alumni/AlmuniRouter";
import useMediaQuery from "./hooks/useMediaQuery";
import useHideOnScroll from "./hooks/useHideOnScroll";
import { TouchPointsContextProvider } from "./contexts/TouchpointsContext";

// Admin pages are lazy-loaded so none of their code is in the main bundle. The gated
// ones (alumni, recent games) load their editor only after the password is accepted.
const AlumniAdminRoute = lazy(() => import("./views/Admin/AdminRoutes").then((m) => ({ default: m.AlumniAdminRoute })));
const RecentGamesAdminRoute = lazy(() => import("./views/Admin/AdminRoutes").then((m) => ({ default: m.RecentGamesAdminRoute })));
const StopsEditor = lazy(() => import("./views/Admin/StopsEditor"));

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useMediaQuery("(max-width: 900px)"); // matches styles/mobile.css
  const topBarHidden = useHideOnScroll(isMobile, pathname);
  function handleNavClick (viewOpt) {
    navigate(viewOpt.route);
  }
  return (
    <TouchPointsContextProvider>
      <div className={`flex-c App${topBarHidden ? " App--top-bar-hidden" : ""}`}>
        <div className="top-bar">
          <Header />
          <Nav options={views} onOptionClick={handleNavClick}/>
        </div>
        <div className="content">
          <Routes>
            <Route index element={<Home />} />
            <Route path="lineups" element={<LineupRouter />}>
              <Route index element={<LatestGameRedirect basePath="lineups" />} />
              <Route path=":name" element={<GameLineups />} />
              <Route path="season" element={<SeasonLineups /> } />
            </Route>
            <Route path="clutch" element={<ClutchRouter />}>
              <Route index element={<LatestGameRedirect basePath="clutch" />} />
              <Route path=":name" element={<GameClutch />} />
            </Route>
            <Route path="kills" element={<KillsRouter />}>
              <Route index element={<LatestGameRedirect basePath="kills" />} />
              <Route path=":name" element={<Kills />} />
            </Route>
            <Route path="alumni" element={<AlumniRouter />} ></Route>
            {/* Hidden — not in nav, only reachable by navigating directly here */}
            <Route path="admin/alumni" element={<Suspense fallback={null}><AlumniAdminRoute /></Suspense>} ></Route>
            <Route path="admin/recent-games" element={<Suspense fallback={null}><RecentGamesAdminRoute /></Suspense>} ></Route>
            <Route path="admin/stops" element={<Suspense fallback={null}><StopsEditor /></Suspense>} ></Route>
            <Route path="admin/stops/:gameId" element={<Suspense fallback={null}><StopsEditor /></Suspense>} ></Route>
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
      </div>
    </TouchPointsContextProvider>
  );
}
