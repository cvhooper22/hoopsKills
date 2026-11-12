import React from 'react';
import { Link } from 'react-router-dom';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import { RANKINGS } from '../../constants/featureFlags';
import { DEV_PROXY } from './adminApi';
import './AdminHome.css';

// /admin: one place to jump to every admin page. Gated by the password on the deployed site (see AdminRoutes.js) and
// open under `npm start`. `local: true` pages run scripts or edit files on this machine through the dev server
// (src/setupProxy.js), so on a deployed build they are listed but not linked.
export default function AdminHome() {
  const rankingsOn = useFlag(RANKINGS);
  const pages = [
    { to: '/admin/games', title: 'Games', local: true, desc: 'What is deployed for each game. Ingest a game, build its files, and deploy them to S3.' },
    { to: '/admin/rankings', title: 'Rankings', local: true, desc: 'Collect team ratings snapshots, map team names, and upload the rankings timeline.', flag: rankingsOn ? null : '?ff=rankings' },
    { to: '/admin/stops', title: 'Stops editor', local: true, desc: 'Mark which plays were stops for a game and add notes.' },
    { to: '/admin/alumni', title: 'Alumni', desc: 'Edit the alumni list (alum.json in S3).' },
    { to: '/admin/recent-games', title: 'Recent games', desc: 'Last games for each alum, ranked by Game Score, and the weekly post.' },
    { to: '/glossary', title: 'Glossary', desc: 'Every stat term in one place (public, just not in the nav).' },
  ];
  return (
    <div className="admin-home">
      <h2>Admin</h2>
      <p className="admin-home__lede">
        {DEV_PROXY ? 'Running locally: every page is available.' : 'Pages marked "local only" run scripts on your machine, so they only work under npm start.'}
      </p>
      <ul className="admin-home__list">
        {pages.map((p) => {
          const available = !p.local || DEV_PROXY;
          const body = (
            <>
              <span className="admin-home__title">{p.title}{p.local && <span className="admin-home__badge">local only</span>}</span>
              <span className="admin-home__desc">{p.desc}</span>
            </>
          );
          return (
            <li key={p.to}>
              {available
                ? <Link className="admin-home__card" to={p.flag ? `${p.to}${p.flag}` : p.to}>{body}</Link>
                : <div className="admin-home__card admin-home__card--off">{body}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
