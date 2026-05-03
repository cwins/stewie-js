/// <reference types="vite/client" />
// AppShell — persistent chrome (NavBar + content area).
//
// AppShellLayout is a layout route component: it renders the NavBar and
// delegates to <Outlet /> to mount the matched child route. Pages no longer
// need to import or render AppShell themselves.
//
// AppShell remains exported as a standalone wrapper for any non-route contexts
// that still need the chrome.

import type { JSXElement } from '@stewie-js/core';
import { Outlet } from '@stewie-js/router';
import { NavBar } from './NavBar.js';

interface AppShellProps {
  children: JSXElement | JSXElement[];
}

export function AppShell({ children }: AppShellProps): JSXElement {
  return (
    <div class="app-shell">
      <NavBar />
      <div class="app-content">{children}</div>
    </div>
  );
}

/**
 * Layout route component. Renders the persistent chrome (NavBar) and uses
 * <Outlet /> to mount the matched child route in the content area.
 *
 * Register as the root layout route:
 * ```tsx
 * <Route path="/" component={AppShellLayout}>
 *   <Route path="/dashboard" component={Dashboard} />
 *   ...
 * </Route>
 * ```
 */
export function AppShellLayout(): JSXElement {
  return (
    <div class="app-shell">
      <NavBar />
      <div class="app-content">
        <Outlet />
      </div>
    </div>
  );
}
