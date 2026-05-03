/// <reference types="vite/client" />
// Admin page — route: /admin (guarded by requireAuth)
//
// Teaching points:
//   - A route protected by a beforeEnter guard
//   - The guard runs on BOTH the server (createSsrRouter) and the client (navigate())
//   - If not authenticated, the guard redirects to /login?redirect=/admin
//   - Logout clears auth state and navigates away (navigate-to-refresh)

import type { JSXElement } from '@stewie-js/core';
import { useAction } from '@stewie-js/core';
import { useRouter } from '@stewie-js/router';
import { getSession } from '../data/mocks/auth.js';
import { logoutAction } from '../actions/auth.js';
import './AdminPage.css';

// Default export so the route can dynamically import this module via lazy().
// The route in app.tsx uses `lazy(() => import('./pages/AdminPage'))`, which
// the Vite plugin rewrites with the source-relative id 'src/pages/AdminPage.tsx'
// — keying into ssr-manifest.json so renderToStream can emit the boundary's
// CSS/JS hints when the route is server-rendered.
export default AdminPage;
export function AdminPage(): JSXElement {
  const router = useRouter();
  // getSession() is safe to call here: on the server it reflects the current
  // request's session; on the client it reflects the in-memory state after
  // hydration. Since this route is guarded, reaching this component means
  // the user is authenticated on whichever side is running.
  const session = getSession();

  const logout = useAction(logoutAction);

  const handleLogout = async () => {
    await logout.run();
    if (logout.lastRun() !== 'success') return;
    await router.navigate('/');
  };

  return (
    <main class="page" data-testid="admin-page">
      <div class="page-header">
        <h1 class="page-title">Admin</h1>
      </div>

      <div class="admin-welcome" data-testid="admin-welcome">
        <p>
          Welcome, <strong data-testid="admin-username">{session.username}</strong>. You have access to the admin area.
        </p>
        <p class="text-muted">
          This page is protected by a <code>beforeEnter</code> guard. On hard reload, the guard runs server-side inside{' '}
          <code>createSsrRouter()</code>. On client-side navigation, it runs in the browser before the route renders.
        </p>
      </div>

      <div class="admin-section">
        <h2 class="section-title">Session</h2>
        <dl class="detail-list">
          <dt>Username</dt>
          <dd data-testid="session-username">{session.username}</dd>
          <dt>Authenticated</dt>
          <dd>{session.isAuthenticated ? 'Yes' : 'No'}</dd>
        </dl>
      </div>

      <div class="admin-actions">
        <button type="button" class="btn btn-destructive-outline" onClick={handleLogout} data-testid="logout-btn">
          Log out
        </button>
      </div>
    </main>
  );
}
