/// <reference types="vite/client" />
// app.tsx — isomorphic App component for the Work Queue canonical example.
//
// This file is the version-sensitive integration layer. It wires together:
//   - the router (Route table with loaders)
//   - the persistent layout (AppShellLayout via nested routes)
//   - the SSR entry point (renderApp)
//
// Everything else — data, loaders, actions, pages — is in stable layers that
// don't change when Stewie APIs change.
//
// Version-sensitive seams in this file:
//   - Router / Route / createSsrRouter API
//   - renderToString / renderToStream API
//   - JSX import source / component function signature

import type { JSXElement } from '@stewie-js/core';
import { lazy } from '@stewie-js/core';
import { Router, Route, createSsrRouter, RedirectError } from '@stewie-js/router';
import { renderToString } from '@stewie-js/server';
import type { RenderResult, SSRManifest } from '@stewie-js/server';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { ProjectDetailPage } from './pages/ProjectDetailPage.js';
import { NewProjectPage } from './pages/NewProjectPage.js';
import { EditProjectPage } from './pages/EditProjectPage.js';
import { TaskDetailPage } from './pages/TaskDetailPage.js';
import { LoginPage } from './pages/LoginPage.js';
// AdminPage is loaded lazily so its scoped CSS (pages/AdminPage.css) becomes
// a per-boundary asset. The Vite plugin rewrites the import below with the
// source-relative manifest id so renderToStream emits the boundary's
// <link rel="stylesheet"> and <link rel="modulepreload"> hints when the
// route SSRs, and the client gates hydration on the stylesheet load event.
const AdminPage = lazy(() => import('./pages/AdminPage'));
import { dashboardLoader } from './loaders/dashboard.js';
import { projectsLoader } from './loaders/projects.js';
import { projectDetailLoader } from './loaders/project-detail.js';
import { projectEditLoader } from './loaders/project-edit.js';
import { taskDetailLoader } from './loaders/task-detail.js';
import { requireAuth } from './data/mocks/auth.js';
import { AppShellLayout } from './components/AppShell.js';
import './styles.css';

// ---------------------------------------------------------------------------
// Route definitions
//
// All authenticated/app routes are nested under the root AppShellLayout
// so the NavBar and chrome render once at the layout level. Each page
// component no longer needs to render <AppShell> itself.
//
// /login is a standalone route (no shell) so the login page has full control
// over its layout.
//
// Route loaders receive matched URL params and query from the router.
// The result is available inside the page component via useRouteData<T>().
// ---------------------------------------------------------------------------

const routeElements = [
  // Root layout — AppShellLayout renders <NavBar /> + <Outlet />
  // All routes share the NavBar chrome; pages only render their <main> content.
  <Route path="/" component={AppShellLayout}>
    <Route path="." component={DashboardPage} load={dashboardLoader} />
    <Route path="/projects" component={ProjectsPage} load={projectsLoader} />
    <Route path="/projects/new" component={NewProjectPage} />
    <Route path="/projects/:projectId/edit" component={EditProjectPage} load={projectEditLoader} />
    <Route path="/projects/:projectId" component={ProjectDetailPage} load={projectDetailLoader} />
    <Route path="/tasks/:taskId" component={TaskDetailPage} load={taskDetailLoader} />
    <Route path="/admin" component={AdminPage} beforeEnter={requireAuth} />
    <Route path="/login" component={LoginPage} />
  </Route>
];

// ---------------------------------------------------------------------------
// App — root component (isomorphic: runs on server and client)
// ---------------------------------------------------------------------------

// App — the Router is the root. AppShellLayout is the root layout route:
// it renders NavBar + <Outlet /> so every child route gets the chrome automatically.
export function App({
  initialUrl,
  router: ssrRouter
}: { initialUrl?: string; router?: Awaited<ReturnType<typeof createSsrRouter>> } = {}): JSXElement {
  return (
    <Router
      initialUrl={initialUrl}
      router={ssrRouter}
      fallback={
        <div class="nav-loading" aria-live="polite">
          Loading…
        </div>
      }
    >
      {routeElements}
    </Router>
  );
}

// ---------------------------------------------------------------------------
// renderApp — server-side entry point
//
// Used by server.ts for SSR. Runs route guards and loaders via createSsrRouter
// before rendering so the HTML reflects the loaded data at response time.
// ---------------------------------------------------------------------------

export async function renderApp(url: string = '/', manifest?: SSRManifest): Promise<RenderResult & { redirect?: string }> {
  let ssrRouter: Awaited<ReturnType<typeof createSsrRouter>>;
  try {
    ssrRouter = await createSsrRouter(url, routeElements);
  } catch (err) {
    if (err instanceof RedirectError) {
      return { html: '', stateScript: '', headHtml: '', redirect: err.location };
    }
    throw err;
  }

  const result = await renderToString(<App initialUrl={url} router={ssrRouter} />, { manifest });
  return result;
}
