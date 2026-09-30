import React, { lazy, Suspense } from 'react';
import AdminGate from './AdminGate';
import AdminAlumLoader from './AdminAlumLoader';

// Route wrappers for the gated admin pages. The pages themselves are lazy-loaded
// here, inside the gate, so their chunks are only requested after the password
// has been accepted (see App.js for how this file is itself lazy-loaded).
const AlumniEditor = lazy(() => import('./AlumniEditor'));
const RecentGamesAdmin = lazy(() => import('./RecentGamesAdmin'));

const Loading = <div className="admin-gate"><p>Loading…</p></div>;

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
