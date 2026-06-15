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
import { Router, createSsrRouter, RedirectError } from '@stewie-js/router';
import { renderToString } from '@stewie-js/server';
import type { RenderResult, SSRManifest } from '@stewie-js/server';
import {
  AppShellRoute,
  DashboardRoute,
  ProjectsRoute,
  NewProjectRoute,
  ProjectEditRoute,
  ProjectDetailRoute,
  TaskDetailRoute,
  ProfileMeRoute,
  ProfileEditRoute,
  ProfileViewRoute,
  AdminRoute,
  LoginRoute
} from './routes.js';
import './styles.css';
import './transitions.css';

// ---------------------------------------------------------------------------
// Route mounting
//
// Every route's path, type, and runtime config (component + guard + loader)
// is declared in `./routes.ts` via `createRoute(...)`. This file only mounts
// them inside <Router>. AppShellRoute is the root layout (renders NavBar +
// <Outlet />); LoginRoute sits next to it as a standalone route with no shell.
// ---------------------------------------------------------------------------

const routeElements = [
  <AppShellRoute>
    <DashboardRoute />
    <ProjectsRoute />
    <NewProjectRoute />
    <ProjectEditRoute />
    <ProjectDetailRoute />
    <TaskDetailRoute />
    <ProfileMeRoute />
    <ProfileEditRoute />
    <ProfileViewRoute />
    <AdminRoute />
    <LoginRoute />
  </AppShellRoute>
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
