// components.ts — route components

import { jsx, inject, effect, signal, reactiveScope } from '@stewie-js/core';
import type { JSXElement, Component } from '@stewie-js/core';
import { createRouter, RouterContext, RedirectError } from './router.js';
import type { Router, RouteGuard } from './router.js';
import { matchRoute } from './matcher.js';

export interface RouterProps {
  /** Starting URL — defaults to window.location on browser, '/' on server. */
  initialUrl?: string;
  /**
   * Pre-configured router instance produced by `createSsrRouter`.
   * When provided, the Router component skips creating a new router and
   * running guards (they already ran in `createSsrRouter`).
   * Only used for SSR — on the client omit this prop.
   */
  router?: Router;
  /**
   * Rendered while the initial route's guard or data loader is resolving.
   * Defaults to null (nothing shown) if omitted.
   */
  fallback?: JSXElement;
  /** <Route> elements that define the route table. */
  children: JSXElement | JSXElement[];
}

export interface RouteProps {
  path: string;
  component: Component;
  /**
   * Guard called before this route is activated. Return `true` to allow
   * navigation, or a redirect URL string to redirect instead.
   */
  beforeEnter?: RouteGuard;
  /**
   * Async data loader. Called before the route component renders; result is
   * available via `useRouteData()` in the component tree.
   */
  load?: () => Promise<unknown>;
}

export interface LinkProps {
  to: string;
  replace?: boolean;
  children: JSXElement | JSXElement[] | string;
  class?: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RouteConfig {
  path: string;
  component: Component;
  beforeEnter?: RouteGuard;
  load?: () => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract RouteConfig objects from the children of a Router. */
function extractRoutes(children: JSXElement | JSXElement[] | undefined): RouteConfig[] {
  if (!children) return [];
  const arr = Array.isArray(children) ? children : [children];
  return arr
    .filter((c): c is JSXElement => c !== null && c !== undefined && typeof c === 'object' && 'type' in c)
    .filter((c) => c.type === (Route as unknown))
    .map((c) => ({
      path: c.props.path as string,
      component: c.props.component as Component,
      beforeEnter: c.props.beforeEnter as RouteGuard | undefined,
      load: c.props.load as (() => Promise<unknown>) | undefined
    }));
}

/** Find the best-matching route for a given pathname. */
function findBestMatch(
  routes: RouteConfig[],
  pathname: string
): { component: Component; params: Record<string, string> } | null {
  let best: { component: Component; params: Record<string, string>; score: number } | null = null;
  for (const route of routes) {
    const result = matchRoute(route.path, pathname);
    if (result && (!best || result.score > best.score)) {
      best = { component: route.component, params: result.params, score: result.score };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Router component
// ---------------------------------------------------------------------------

/**
 * Provides routing for its children.
 *
 * - Accepts <Route path="…" component={…} /> children to define the route table.
 * - Renders the matched route component for the current URL.
 * - Provides the router instance via RouterContext so child components can call
 *   useRouter(), useParams(), etc.
 * - In the browser, reacts to navigation changes (pushState / popstate).
 *
 * Usage:
 * ```tsx
 * <Router>
 *   <Route path="/" component={Home} />
 *   <Route path="/about" component={About} />
 *   <Route path="/users/:id" component={UserDetail} />
 * </Router>
 * ```
 */
export function Router(props: RouterProps): JSXElement {
  const initialUrl =
    props.initialUrl ??
    (typeof globalThis.location !== 'undefined'
      ? globalThis.location.pathname + globalThis.location.search + globalThis.location.hash
      : '/');

  // Use pre-configured router from createSsrRouter if provided (SSR path).
  // Otherwise create a fresh one (browser path).
  const router = props.router ?? createRouter(initialUrl);
  const routes = extractRoutes(props.children);

  // Register routes so navigate() can resolve params
  router._routes = routes;

  // Wire router teardown into component lifecycle. This effect has no reactive
  // dependencies so it runs once; its cleanup fires when the Router component
  // is unmounted (the dom-renderer disposes reactiveScope effects on unmount).
  effect(() => () => router._dispose());

  // Determine whether the initial URL's matching route needs async resolution
  // (a beforeEnter guard or a load function). If so, hold off rendering the
  // matched content until those promises settle so the guard can redirect and
  // the loader can populate _routeData before anything is shown.
  const initialPathname = initialUrl.split('?')[0].split('#')[0];
  const initialRouteNeedsAsync = routes.some((r) => {
    const result = matchRoute(r.path, initialPathname);
    return result !== null && (r.beforeEnter !== undefined || r.load !== undefined);
  });

  let _ready!: ReturnType<typeof signal<boolean>>;
  // If a pre-configured SSR router was provided, guards already ran — start ready.
  const alreadyResolved = !!props.router;
  reactiveScope(() => {
    _ready = signal(!initialRouteNeedsAsync || alreadyResolved);
  });

  if (initialRouteNeedsAsync && !alreadyResolved) {
    // Fire-and-forget: run the guard / loader for the initial URL in the
    // background. When they resolve, flip _ready which triggers matchedContent
    // to re-evaluate and render the (possibly redirected) route.
    (async () => {
      const redirect = await router._runGuardsAndLoad(initialUrl);
      if (redirect !== null) {
        // Guard issued a redirect — navigate() runs the redirect's own guards too.
        await router.navigate(redirect);
      }
      _ready.set(true);
    })();
  }

  // matchedContent is a reactive function — the DOM renderer wraps it in effect()
  // and re-renders whenever router.location.pathname changes.
  // The SSR renderer calls it once synchronously.
  const matchedContent = (): JSXElement | null => {
    // Show fallback (or nothing) while the initial guard/loader is pending.
    if (!_ready()) return props.fallback ?? null;
    const match = findBestMatch(routes, router.location.pathname);
    if (!match) return null;
    // Keep params in sync with the current match
    if (JSON.stringify(router.location.params) !== JSON.stringify(match.params)) {
      router.location.params = match.params;
    }
    return jsx(match.component, { params: router.location.params });
  };

  return jsx(RouterContext.Provider as unknown as Component, {
    value: router,
    children: matchedContent
  });
}

// ---------------------------------------------------------------------------
// Route component — config-only descriptor, consumed by Router
// ---------------------------------------------------------------------------

/**
 * Declares a route mapping inside a <Router>.
 * This component is never rendered directly; Router scans its children for
 * Route descriptors to build the route table.
 */
export function Route(_props: RouteProps): JSXElement {
  // Route is only a configuration marker. Its JSXElement descriptor is read by
  // Router.extractRoutes() and never rendered directly.
  return jsx('template', {});
}

// ---------------------------------------------------------------------------
// Link component
// ---------------------------------------------------------------------------

/**
 * Client-side navigation anchor.
 * Prevents full-page reloads; uses router.navigate() when a RouterContext
 * is available. Falls back to a normal <a href> otherwise (SSR, no-router).
 *
 * Modifier keys (Ctrl/Cmd/Alt/Shift) allow the browser to handle the click
 * normally (open in new tab, etc.).
 */
export function Link(props: LinkProps): JSXElement {
  // Capture router synchronously during component render (inject works here).
  let router: Router | null = null;
  try {
    router = inject(RouterContext);
  } catch {
    // No RouterContext — fall through, renders as plain anchor
  }

  const handleClick = router
    ? (e: Event) => {
        if (e instanceof MouseEvent && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.button !== 0)) {
          return; // Let browser handle modifier+click
        }
        e.preventDefault();
        router!.navigate({ to: props.to, replace: props.replace });
      }
    : undefined;

  return jsx('a', {
    href: props.to,
    class: props.class,
    children: props.children,
    ...(handleClick ? { onClick: handleClick } : {})
  });
}

// ---------------------------------------------------------------------------
// createSsrRouter — SSR guard + loader helper
// ---------------------------------------------------------------------------

/**
 * Runs route guards and data loaders for the given URL on the server.
 * Returns a pre-configured `Router` instance that can be passed to the
 * `<Router router={...}>` prop, ensuring the rendered HTML reflects the
 * guard outcome and pre-loaded route data.
 *
 * Throws `RedirectError` if any `beforeEnter` guard returns a redirect URL.
 * Catch this in your server handler and return an HTTP 302 response.
 *
 * **Usage:**
 * ```ts
 * import { createSsrRouter, RedirectError, Router, Route } from '@stewie-js/router'
 * import { renderToString } from '@stewie-js/server'
 *
 * // Define routes once — reuse in createSsrRouter and <Router>
 * const routes = jsx(Fragment, { children: [
 *   jsx(Route, { path: '/', component: Home }),
 *   jsx(Route, { path: '/protected', component: Protected, beforeEnter: authGuard }),
 * ]})
 *
 * // In your SSR request handler:
 * try {
 *   const ssrRouter = await createSsrRouter(req.url, routes)
 *   const { html, stateScript } = await renderToString(
 *     jsx(Router, { router: ssrRouter, children: routes })
 *   )
 *   return new Response(html + stateScript, { headers: { 'content-type': 'text/html' } })
 * } catch (err) {
 *   if (err instanceof RedirectError) {
 *     return new Response(null, { status: 302, headers: { location: err.location } })
 *   }
 *   throw err
 * }
 * ```
 */
export async function createSsrRouter(
  url: string,
  routes: import('@stewie-js/core').JSXElement | import('@stewie-js/core').JSXElement[]
): Promise<Router> {
  const routeConfigs = extractRoutes(Array.isArray(routes) ? routes : [routes]);
  const router = createRouter(url);
  router._routes = routeConfigs;

  const redirect = await router._runGuardsAndLoad(url);
  if (redirect !== null) {
    throw new RedirectError(redirect);
  }

  return router;
}
