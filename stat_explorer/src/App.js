import { lazy, Suspense, useMemo } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import "./App.css";
import Header from './components/Layout/Header';
import Nav from "./components/Layout/Nav";
// import Lineups from "./views/Lineups/Lineups";
import LineupRouter from "./views/Lineups/LineupRouter";
import ClutchRouter from './views/Clutch/ClutchRouter';
import GameLineups from './views/Lineups/components/GameLineups';
import SeasonLineups from "./views/Lineups/components/SeasonLineups";
import GameClutch from './views/Clutch/components/GameClutch';
import ClutchSeason from './views/Clutch/season/ClutchSeason';
import Kills from "./views/Kills/Kills";
import KillsSeason from "./views/Kills/KillsSeason";
import KillsRouter from "./views/Kills/KillsRouter";
import LatestGameRedirect from "./components/GameSwitcher/LatestGameRedirect";
import Home from "./views/Home/Home";
import Exhibitions from "./views/Exhibitions/Exhibitions";
import BoxRouter, { LatestBox } from "./views/Box/BoxRouter";
import Box, { BoxScoreTab, BoxStintCompareTab, BoxFindTab, BoxTimelineTab, BoxLineupCompareTab, BoxEventTimelineTab, BoxShotsTab, BoxShotCompareTab, BoxAnalyticallyFinalTab } from "./views/Box/Box";
import { LiveRouter, LiveIndex, LiveGame, LiveBox, LiveStintCompare, LiveEventTimeline, LiveFind, LiveAnalyticallyFinal, LiveTimeline, LiveLineupCompare, LiveKills, LiveLineups, LiveShots, LiveShotCompare } from "./views/Box/LiveBox";
import { views, COLLECTION_VIEW, RANKINGS_VIEW, EXHIBITIONS_NAV_VIEW } from './constants/views';
import AlumniRouter from "./views/Alumni/AlmuniRouter";
import useMediaQuery from "./hooks/useMediaQuery";
import useHideOnScroll from "./hooks/useHideOnScroll";
import { TouchPointsContextProvider } from "./contexts/TouchpointsContext";
import { FeatureFlagsProvider, useFlag } from "./contexts/FeatureFlagsContext";
import { CollectionProvider, useCollection } from "./contexts/CollectionContext";
import { COLLECTION, LIVE_GAME, RANKINGS, EXHIBITIONS } from "./constants/featureFlags";

// Admin pages are lazy-loaded so none of their code is in the main bundle. The gated
// ones (alumni, recent games) load their editor only after the password is accepted.
const AlumniAdminRoute = lazy(() => import("./views/Admin/AdminRoutes").then((m) => ({ default: m.AlumniAdminRoute })));
const RecentGamesAdminRoute = lazy(() => import("./views/Admin/AdminRoutes").then((m) => ({ default: m.RecentGamesAdminRoute })));
const AdminHomeRoute = lazy(() => import("./views/Admin/AdminRoutes").then((m) => ({ default: m.AdminHomeRoute })));
const GamesAdminRoute = lazy(() => import("./views/Admin/AdminRoutes").then((m) => ({ default: m.GamesAdminRoute })));
const StopsEditor = lazy(() => import("./views/Admin/StopsEditor"));
const GlossaryPage = lazy(() => import("./views/Glossary/GlossaryPage"));
const RankingsAdmin = lazy(() => import("./views/Admin/RankingsAdmin"));
// Behind the `collection` feature flag (see constants/featureFlags.js).
const Collection = lazy(() => import("./views/Collection/Collection"));
// Behind the `rankings` feature flag: BYU's ratings timeline.
const RankingsTimeline = lazy(() => import("./views/Rankings/RankingsTimeline"));

export default function App() {
  return (
    <FeatureFlagsProvider>
      <CollectionProvider>
        <TouchPointsContextProvider>
          <AppContent />
        </TouchPointsContextProvider>
      </CollectionProvider>
    </FeatureFlagsProvider>
  );
}

// /box/... was the prototype home of the box score; it now lives under /games.
function BoxLegacyRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate replace to={pathname.replace(/^\/box/, "/games") + search} />;
}

function AppContent() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useMediaQuery("(max-width: 900px)"); // matches styles/mobile.css
  const topBarHidden = useHideOnScroll(isMobile, pathname);
  const collectionOn = useFlag(COLLECTION);
  const liveOn = useFlag(LIVE_GAME);
  const rankingsOn = useFlag(RANKINGS);
  const exhibitionsOn = useFlag(EXHIBITIONS);
  const { count: collectionCount } = useCollection();
  const navViews = useMemo(
    () => [...views, ...(exhibitionsOn ? [EXHIBITIONS_NAV_VIEW] : []), ...(rankingsOn ? [RANKINGS_VIEW] : []), ...(collectionOn ? [{ ...COLLECTION_VIEW, badge: collectionCount }] : [])],
    [collectionOn, rankingsOn, exhibitionsOn, collectionCount]
  );
  function handleNavClick (viewOpt) {
    navigate(viewOpt.route);
  }
  return (
    <>
      <div className={`flex-c App${topBarHidden ? " App--top-bar-hidden" : ""}`}>
        <div className="top-bar">
          <Header />
          <Nav options={navViews} onOptionClick={handleNavClick}/>
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
              <Route index element={<Navigate replace to="/clutch/season" />} />
              <Route path="season" element={<ClutchSeason />} />
              <Route path="latest" element={<LatestGameRedirect basePath="clutch" />} />
              <Route path=":name" element={<GameClutch />} />
            </Route>
            <Route path="kills" element={<KillsRouter />}>
              <Route index element={<Navigate replace to="/kills/season" />} />
              <Route path="season" element={<KillsSeason />} />
              <Route path="seasons" element={<Navigate replace to="/kills/season" />} />
              <Route path="latest" element={<LatestGameRedirect basePath="kills" />} />
              <Route path=":name" element={<Kills />} />
            </Route>
            {exhibitionsOn && <Route path="exhibitions" element={<Exhibitions />} />}
            <Route path="box/*" element={<BoxLegacyRedirect />} />
            <Route path="games" element={<BoxRouter />}>
              <Route index element={<LatestBox />} />
              <Route path=":name" element={<Box />}>
                <Route index element={<BoxScoreTab />} />
                <Route path="find" element={<BoxFindTab />} />
                <Route path="analytically-final" element={<BoxAnalyticallyFinalTab />} />
                <Route path="timeline" element={<BoxTimelineTab />} />
                <Route path="stint-compare" element={<BoxStintCompareTab />} />
                <Route path="event-timeline" element={<BoxEventTimelineTab />} />
                <Route path="lineup-compare" element={<BoxLineupCompareTab />} />
                <Route path="shots" element={<BoxShotsTab />} />
                <Route path="shot-compare" element={<BoxShotCompareTab />} />
              </Route>
            </Route>
            {/* Behind the `liveGame` flag (?ff=liveGame): the in-game page, fed by the local live box server */}
            {liveOn && (
              <Route path="live" element={<LiveRouter />}>
                <Route index element={<LiveIndex />} />
                <Route path=":name" element={<LiveGame />}>
                  <Route index element={<LiveBox />} />
                  <Route path="stint-compare" element={<LiveStintCompare />} />
                  <Route path="event-timeline" element={<LiveEventTimeline />} />
                  <Route path="find" element={<LiveFind />} />
                  <Route path="analytically-final" element={<LiveAnalyticallyFinal />} />
                  <Route path="timeline" element={<LiveTimeline />} />
                  <Route path="lineup-compare" element={<LiveLineupCompare />} />
                  <Route path="kills" element={<LiveKills />} />
                  <Route path="lineups" element={<LiveLineups />} />
                  <Route path="shots" element={<LiveShots />} />
                  <Route path="shot-compare" element={<LiveShotCompare />} />
                </Route>
              </Route>
            )}
            <Route path="alumni" element={<AlumniRouter />} ></Route>
            {rankingsOn && <Route path="rankings" element={<Suspense fallback={null}><RankingsTimeline /></Suspense>} />}
            {collectionOn && <Route path="collection" element={<Suspense fallback={null}><Collection /></Suspense>} />}
            {/* Hidden — not in nav, only reachable by navigating directly here */}
            <Route path="glossary" element={<Suspense fallback={null}><GlossaryPage /></Suspense>} />
            <Route path="admin" element={<Suspense fallback={null}><AdminHomeRoute /></Suspense>} ></Route>
            <Route path="admin/games" element={<Suspense fallback={null}><GamesAdminRoute /></Suspense>} ></Route>
            <Route path="admin/alumni" element={<Suspense fallback={null}><AlumniAdminRoute /></Suspense>} ></Route>
            <Route path="admin/recent-games" element={<Suspense fallback={null}><RecentGamesAdminRoute /></Suspense>} ></Route>
            {rankingsOn && <Route path="admin/rankings" element={<Suspense fallback={null}><RankingsAdmin /></Suspense>} />}
            <Route path="admin/stops" element={<Suspense fallback={null}><StopsEditor /></Suspense>} ></Route>
            <Route path="admin/stops/:gameId" element={<Suspense fallback={null}><StopsEditor /></Suspense>} ></Route>
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
      </div>
    </>
  );
}
