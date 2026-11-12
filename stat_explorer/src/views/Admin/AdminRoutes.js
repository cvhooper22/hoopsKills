import React, { lazy, Suspense } from 'react';
import AdminGate from './AdminGate';
import AdminAlumLoader from './AdminAlumLoader';

// Route wrappers for the gated admin pages. The pages themselves are lazy-loaded
// here, inside the gate, so their chunks are only requested after the password
// has been accepted (see App.js for how this file is itself lazy-loaded).
const AlumniEditor = lazy(() => import('./AlumniEditor'));
const RecentGamesAdmin = lazy(() => import('./RecentGamesAdmin'));
const AdminHome = lazy(() => import('./AdminHome'));
const GamesAdmin = lazy(() => import('./GamesAdmin'));

const Loading = <div className="admin-gate"><p>Loading…</p></div>;

// /admin: the index of admin pages. Password-gated when deployed, open under `npm start` (AdminGate skips itself there).
export function AdminHomeRoute() {
  return (
    <AdminGate>
      <Suspense fallback={Loading}>
        <AdminHome />
      </Suspense>
    </AdminGate>
  );
}

// /admin/games: runs local scripts, so it only does anything under `npm start`; behind the gate on a deployed build too,
// where it just explains that.
export function GamesAdminRoute() {
  return (
    <AdminGate>
      <Suspense fallback={Loading}>
        <GamesAdmin />
      </Suspense>
    </AdminGate>
  );
}

export function AlumniAdminRoute() {
  return (
    <AdminGate>
      <AdminAlumLoader>
        {(alum) => (
          <Suspense fallback={Loading}>
            <AlumniEditor initialAlum={alum} />
          </Suspense>
        )}
      </AdminAlumLoader>
    </AdminGate>
  );
}

export function RecentGamesAdminRoute() {
  return (
    <AdminGate>
      <AdminAlumLoader>
        {(alum) => (
          <Suspense fallback={Loading}>
            <RecentGamesAdmin initialAlum={alum} />
          </Suspense>
        )}
      </AdminAlumLoader>
    </AdminGate>
  );
}
