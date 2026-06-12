// components.ts — route components

import { jsx, consume, effect, signal, reactiveScope, useHydrationRegistry } from '@stewie-js/core';
import type { JSXElement, Component } from '@stewie-js/core';
import { createRouter, RouterContext, RedirectError, OutletContext } from './router.js';
import type { Router, RouteGuard, FlatRouteChain, RouteChainLevel, OutletContextValue } from './router.js';
import { matchRoute } from './matcher.js';
import type { TypedRoute, PathParams } from './typed-routes.js';

// Marker symbol attached to TypedRoute functions returned by createRoute().
// The Router uses this to distinguish a TypedRoute component from a plain
// component when extracting route configs from JSX children. A symbol is
// preferable to a string property because it cannot collide with user code
// or with React-shaped function shapes.
const TYPED_ROUTE_MARKER = Symbol.for('@stewie-js/router/typed-route');

interface TypedRouteMeta {
  [TYPED_ROUTE_MARKER]: true;
  path: string;
  component: Component;
  beforeEnter?: RouteGuard;
  load?: (params: Record<string, string>, query: Record<string, string>) => Promise<unknown>;
  transition?: string;
}

function isTypedRoute(value: unknown): value is TypedRouteMeta {
  return typeof value === 'function' && (value as unknown as Record<symbol, unknown>)[TYPED_ROUTE_MARKER] === true;
}

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
   * Receives the matched URL params and query string as arguments.
   */
  load?: (params: Record<string, string>, query: Record<string, string>) => Promise<unknown>;
  /**
   * Transition group name. Free-form string. When a navigation moves
   * *between* this route level and a descendant or ancestor, the View
   * Transition emits the type `stewie-transition-{name}` so CSS can scope
   * a directional animation to the move. Typically set on a layout route
   * (`/settings`) so all child navigations inside it can share a slide
   * animation while moves out of the group fall back to the default.
   *
   * See docs/guide/routing.md for the emission rule and CSS cookbook.
   */
  transition?: string;
  /** Nested <Route> elements that define child routes under this layout. */
  children?: JSXElement | JSXElement[];
}

export interface LinkProps {
  to: string;
  replace?: boolean;
  children: JSXElement | JSXElement[] | string;
  class?: string;
  /**
   * Whether to preload the destination on hover and focus. Defaults to `true`.
   *
   * Preloading runs the destination chain's guards + loaders (without
   * committing the navigation) and warms any lazy component chunks, so a
   * subsequent click resolves instantly. Set `false` to opt out — useful for
   * links to expensive routes or links the user is unlikely to follow.
   */
  prefetch?: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RouteConfig {
  path: string;
  component: Component;
  beforeEnter?: RouteGuard;
  load?: (params: Record<string, string>, query: Record<string, string>) => Promise<unknown>;
  transition?: string;
  children?: JSXElement | JSXElement[];
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate a route path value.
 * - Top-level paths must start with '/'.
 * - Nested paths must start with '/' OR be exactly '.'.
 * - A nested path of '/' is rejected (it would double-slash on concat).
 */
function validatePath(path: string, parentPath: string | null): void {
  if (path === '/') {
    if (parentPath !== null) {
      throw new Error(
        `[stewie/router] Invalid nested route path "${path}" under "${parentPath}". ` +
          `Child path "/" is not allowed (it would produce double-slash on concat). ` +
          `Use path="." for an index route.`
      );
    }
    return; // Root "/" is valid at the top level
  }
  if (path === '.') {
    if (parentPath === null) {
      throw new Error(`[stewie/router] path="." is only valid as a child route (index route). It cannot be a top-level route.`);
    }
    return; // Valid index route
  }
  if (!path.startsWith('/')) {
    throw new Error(
      `[stewie/router] Invalid route path "${path}"${parentPath !== null ? ` under "${parentPath}"` : ''}. ` +
        `All route paths must start with "/" (or use "." for an index route).`
    );
  }
}

// ---------------------------------------------------------------------------
// Route tree walking — flatten nested <Route> trees into FlatRouteChain[]
// ---------------------------------------------------------------------------

/**
 * Extract RouteConfig objects from a JSXElement or array of JSXElements.
 *
 * Recognises two declaration styles:
 *  - Raw `<Route path="..." component={...} />` JSX (config lives in `props`).
 *  - A `createRoute()` component used as JSX (`<ProjectEditRoute />`); config
 *    lives on the function itself behind `TYPED_ROUTE_MARKER`, and any
 *    nested children come from `props.children` at the JSX usage site.
 */
function extractRouteConfigs(children: JSXElement | JSXElement[] | undefined): RouteConfig[] {
  if (!children) return [];
  const arr = Array.isArray(children) ? children : [children];
  const configs: RouteConfig[] = [];
  for (const c of arr) {
    if (c === null || c === undefined || typeof c !== 'object' || !('type' in c)) continue;
    if (c.type === (Route as unknown)) {
      configs.push({
        path: c.props.path as string,
        component: c.props.component as Component,
        beforeEnter: c.props.beforeEnter as RouteGuard | undefined,
        load: c.props.load as ((params: Record<string, string>, query: Record<string, string>) => Promise<unknown>) | undefined,
        transition: c.props.transition as string | undefined,
        children: c.props.children as JSXElement | JSXElement[] | undefined
      });
      continue;
    }
    if (isTypedRoute(c.type)) {
      configs.push({
        path: c.type.path,
        component: c.type.component,
        beforeEnter: c.type.beforeEnter,
        load: c.type.load,
        transition: c.type.transition,
        children: c.props.children as JSXElement | JSXElement[] | undefined
      });
      continue;
    }
  }
  return configs;
}

/**
 * Recursively walk the route tree and produce a flat array of FlatRouteChain.
 * Each chain represents a full path from root to leaf.
 *
 * @param configs - Route configs at the current nesting depth
 * @param ancestorLevels - Already-resolved levels from ancestor routes
 * @param ancestorPath - Concatenated path from ancestor routes (null = top level)
 */
function walkRoutes(configs: RouteConfig[], ancestorLevels: RouteChainLevel[], ancestorPath: string | null): FlatRouteChain[] {
  const chains: FlatRouteChain[] = [];

  for (const config of configs) {
    validatePath(config.path, ancestorPath);

    // Compute the full path for this level
    let fullPath: string;
    if (config.path === '.') {
      // Index route: inherits the exact parent path
      fullPath = ancestorPath ?? '/';
    } else if (ancestorPath === null) {
      fullPath = config.path;
    } else {
      // Literal concatenation: /parent + /child = /parent/child
      fullPath = ancestorPath + config.path;
    }

    const level: RouteChainLevel = {
      fullPath,
      component: config.component,
      beforeEnter: config.beforeEnter,
      load: config.load,
      transition: config.transition
    };

    const childConfigs = extractRouteConfigs(config.children);

    if (childConfigs.length === 0) {
      // Leaf route — this chain is complete
      chains.push({
        leafPath: fullPath,
        levels: [...ancestorLevels, level]
      });
    } else {
      // Layout route — walk children, passing down levels and fullPath
      const childChains = walkRoutes(childConfigs, [...ancestorLevels, level], fullPath);
      chains.push(...childChains);
    }
  }

  return chains;
}

/**
 * Extract and flatten all routes from the children of a Router component.
 * Throws at setup time if any path is invalid.
 */
function flattenRoutes(children: JSXElement | JSXElement[] | undefined): FlatRouteChain[] {
  const configs = extractRouteConfigs(children);
  return walkRoutes(configs, [], null);
}

/** Find the best-matching chain for a given pathname. */
function findBestChain(chains: FlatRouteChain[], pathname: string): { chain: FlatRouteChain; params: Record<string, string> } | null {
  let best: { chain: FlatRouteChain; params: Record<string, string>; score: number } | null = null;
  for (const chain of chains) {
    const result = matchRoute(chain.leafPath, pathname);
    if (result && (!best || result.score > best.score)) {
      best = { chain, params: result.params, score: result.score };
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
 * - Supports nested <Route> trees for layout routes (a route with children is a layout;
 *   its component must render <Outlet /> to mount the matched child route).
 * - Renders the matched route component for the current URL.
 * - Provides the router instance via RouterContext so child components can call
 *   useRouter(), useParams(), etc.
 * - In the browser, reacts to navigation changes (pushState / popstate).
 *
 * Usage (flat):
 * ```tsx
 * <Router>
 *   <Route path="/" component={Home} />
 *   <Route path="/about" component={About} />
 * </Router>
 * ```
 *
 * Usage (nested layouts):
 * ```tsx
 * <Router>
 *   <Route path="/app" component={AppLayout}>
 *     <Route path="." component={AppHome} />
 *     <Route path="/settings" component={Settings} />
 *   </Route>
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

  // Flatten the route tree at setup time. Throws for invalid paths.
  const chains = flattenRoutes(props.children);

  // Register chains so navigate() can resolve params
  router._chains = chains;

  // Wire router teardown into component lifecycle. This effect has no reactive
  // dependencies so it runs once; its cleanup fires when the Router component
  // is unmounted (the dom-renderer disposes reactiveScope effects on unmount).
  effect(() => () => router._dispose());

  // Determine whether the initial URL's matching chain needs async resolution
  // (a beforeEnter guard or a load function on any level). If so, hold off
  // rendering the matched content until those promises settle.
  //
  // When a pre-configured SSR router is provided, use its location.pathname
  // (which reflects the URL passed to createSsrRouter) rather than the derived
  // initialUrl (which may fall back to window.location and differ in test envs).
  const initialPathname = props.router ? props.router.location.pathname : initialUrl.split('?')[0].split('#')[0];
  const initialChainMatch = findBestChain(chains, initialPathname);
  const initialRouteNeedsAsync = initialChainMatch
    ? initialChainMatch.chain.levels.some((l) => l.beforeEnter !== undefined || l.load !== undefined)
    : false;

  // If a pre-configured SSR router was provided, guards already ran — start ready.
  const alreadyResolved = !!props.router;

  // ---------------------------------------------------------------------------
  // Hydration registry integration
  //
  // Route loader data must survive the SSR → client handoff. Each level's data
  // is serialized under a per-level key so layouts and leaves can be restored
  // independently.
  // ---------------------------------------------------------------------------
  const ROUTE_DATA_KEY_PREFIX = '__stewie_route_data__:';
  const hydrationRegistry = useHydrationRegistry();

  // SSR: serialize all matched chain level data into the registry.
  if (alreadyResolved && hydrationRegistry && initialChainMatch) {
    for (const level of initialChainMatch.chain.levels) {
      const sig = router._routeDataMap.get(level.fullPath);
      const data = sig ? sig() : undefined;
      if (data !== undefined) {
        hydrationRegistry.set(ROUTE_DATA_KEY_PREFIX + level.fullPath, data);
      }
    }
  }

  // Client hydration: restore per-level route data from the registry.
  let clientHydrated = false;
  if (!alreadyResolved && hydrationRegistry && initialChainMatch) {
    let anyRestored = false;
    for (const level of initialChainMatch.chain.levels) {
      const preloadedData = hydrationRegistry.get(ROUTE_DATA_KEY_PREFIX + level.fullPath);
      if (preloadedData !== undefined) {
        // Ensure signal exists before setting
        let sig = router._routeDataMap.get(level.fullPath);
        if (!sig) {
          reactiveScope(() => {
            sig = signal<unknown>(undefined);
          });
          router._routeDataMap.set(level.fullPath, sig!);
        }
        router._routeDataMap.get(level.fullPath)!.set(preloadedData as unknown);
        anyRestored = true;
      }
    }
    if (anyRestored) clientHydrated = true;
  }

  let _ready!: ReturnType<typeof signal<boolean>>;
  reactiveScope(() => {
    _ready = signal(!initialRouteNeedsAsync || alreadyResolved || clientHydrated);
  });

  if (initialRouteNeedsAsync && !alreadyResolved && !clientHydrated) {
    // Fire-and-forget: run guards / loaders for the initial URL in the background.
    (async () => {
      const redirect = await router._runGuardsAndLoad(initialUrl);
      if (redirect !== null) {
        await router.navigate(redirect);
      }
      _ready.set(true);
    })();
  }

  // matchedContent is a reactive function — the DOM renderer wraps it in effect()
  // and re-renders whenever router.location.pathname changes.
  const matchedContent = (): JSXElement | null => {
    if (!_ready()) return props.fallback ?? null;
    const best = findBestChain(chains, router.location.pathname);
    if (!best) return null;
    // Keep params in sync with the current match
    if (JSON.stringify(router.location.params) !== JSON.stringify(best.params)) {
      router.location.params = best.params;
    }
    // Establish OutletContext at depth=0 for the root render.
    // Each <Outlet /> will bump depth before rendering the next level.
    // Use the Provider JSX form so the SSR renderer can thread context across
    // async boundaries (plain provide() scope closes before async children render).
    const rootContext: OutletContextValue = { chain: best.chain, depth: 0 };
    const rootLevel = best.chain.levels[0];
    return jsx(OutletContext.Provider as unknown as Component, {
      value: rootContext,
      children: jsx(rootLevel.component as Component, { params: router.location.params })
    });
  };

  return jsx(RouterContext.Provider as unknown as Component, {
    value: router,
    children: matchedContent
  });
}

// ---------------------------------------------------------------------------
// Outlet component — renders the next matched route in the chain
// ---------------------------------------------------------------------------

export interface OutletProps {
  [key: string]: unknown;
}

/**
 * Renders the next matched route component in the layout chain.
 *
 * Place `<Outlet />` inside a layout route's component to declare where the
 * matched child route should render. The router replaces the Outlet with the
 * matched child component at the appropriate nesting depth.
 *
 * Any extra props passed to `<Outlet />` are forwarded to the matched child
 * component as additional props.
 *
 * ```tsx
 * // Layout route component
 * function AppLayout(props) {
 *   return (
 *     <div class="app">
 *       <NavBar />
 *       <Outlet />
 *     </div>
 *   );
 * }
 * ```
 */
export function Outlet(props: OutletProps = {}): JSXElement | null {
  let ctx: OutletContextValue | null = null;
  try {
    ctx = consume(OutletContext);
  } catch {
    // Not inside a Router — silently render nothing
    return null;
  }

  if (!ctx) return null;

  const nextDepth = ctx.depth + 1;
  const nextLevel = ctx.chain.levels[nextDepth];

  if (!nextLevel) {
    // No deeper level — we're already at the leaf. Nothing to render.
    return null;
  }

  const nextContext: OutletContextValue = { chain: ctx.chain, depth: nextDepth };

  // Retrieve the router for params forwarding
  let router: Router | null = null;
  try {
    router = consume(RouterContext);
  } catch {
    // ignore
  }

  const params = router?.location.params ?? {};

  // In dev mode: mark that Outlet was consumed. The parent layout's dev
  // warning check (below) reads this flag.
  if (typeof process === 'undefined' || (process as { env?: { NODE_ENV?: string } }).env?.NODE_ENV !== 'production') {
    // Flag is tracked per-render via the context; no persistent state needed
    // since the check runs synchronously during the same render pass.
  }

  // Use the Provider JSX form so the SSR renderer can thread context across
  // async boundaries (plain provide() scope closes before async children render).
  return jsx(OutletContext.Provider as unknown as Component, {
    value: nextContext,
    children: jsx(nextLevel.component as Component, { ...props, params })
  });
}

// ---------------------------------------------------------------------------
// Route component — config-only descriptor, consumed by Router
// ---------------------------------------------------------------------------

/**
 * Declares a route mapping inside a <Router>.
 * This component is never rendered directly; Router scans its children for
 * Route descriptors to build the route table.
 *
 * A Route with children is a layout route — its `component` must call `<Outlet />`
 * to render the matched child route.
 *
 * A Route without children is a leaf route — it is rendered directly.
 */
export function Route(_props: RouteProps): JSXElement {
  // Route is only a configuration marker. Its JSXElement descriptor is read by
  // flattenRoutes() and never rendered directly.
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
  const { to, replace, class: className, children, prefetch, ...rest } = props;
  // Capture router synchronously during component render (consume works here).
  let router: Router | null = null;
  try {
    router = consume(RouterContext);
  } catch {
    // No RouterContext — fall through, renders as plain anchor
  }

  const handleClick = router
    ? (e: Event) => {
        if (e instanceof MouseEvent && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.button !== 0)) {
          return; // Let browser handle modifier+click
        }
        e.preventDefault();
        router!.navigate({ to, replace });
      }
    : undefined;

  // Prefetch on intent (hover, focus). Fire-and-forget: preload() dedupes
  // internally and any errors are absorbed so a hover never produces a
  // user-visible failure. Skipped when no router (SSR / plain anchor) or
  // when the caller opts out with `prefetch={false}`.
  const handlePrefetch =
    router && prefetch !== false
      ? () => {
          router!.preload({ to }).catch(() => {});
        }
      : undefined;

  return jsx('a', {
    ...rest,
    href: to,
    class: className,
    children,
    ...(handleClick ? { onClick: handleClick } : {}),
    ...(handlePrefetch ? { onMouseEnter: handlePrefetch, onFocus: handlePrefetch } : {})
  });
}

// ---------------------------------------------------------------------------
// createRoute — typed route definitions
// ---------------------------------------------------------------------------

/**
 * Runtime + type configuration for a single route. The same object the raw
 * `<Route>` JSX accepts in its props, minus `path` (which is the first
 * argument to `createRoute`) and `children` (which come from the JSX usage
 * site, not the definition).
 */
export interface CreateRouteConfig {
  component: Component;
  beforeEnter?: RouteGuard;
  load?: (params: Record<string, string>, query: Record<string, string>) => Promise<unknown>;
  /**
   * Transition group name. See {@link RouteProps.transition}. Typically set
   * on a layout route to scope a directional animation to navigations that
   * cross into or out of that layout.
   */
  transition?: string;
}

/**
 * Define a typed route in one place — path, param shape, query shape, and
 * runtime config (component + guard + loader) live in a single declaration.
 *
 * The returned value is callable as a JSX component (so
 * `<ProjectEditRoute />` mounts the route inside a `<Router>`) and carries
 * phantom-type properties that `useParams(route)` / `useQuery(route)` read
 * to recover `P` and `Q` at the call site without a generic argument.
 *
 * The first overload infers `P` from the path literal via `PathParams`.
 * The second overload accepts explicit `P` and `Q` generics for routes
 * with no params or with a non-trivial query shape.
 *
 * @example
 * // Path-inferred params:
 * export const ProjectEditRoute = createRoute(
 *   '/projects/:projectId/edit',
 *   { component: EditProjectPage, load: projectEditLoader }
 * );
 * // P = { projectId: string }, Q = {}
 *
 * @example
 * // Explicit shapes (no params, with query):
 * export const LoginRoute = createRoute<{}, { redirect?: string }>(
 *   '/login',
 *   { component: LoginPage }
 * );
 *
 * @example
 * // Layout route with nested children declared at the JSX usage site:
 * export const AppShellRoute = createRoute('/', { component: AppShellLayout });
 *
 * <Router>
 *   <AppShellRoute>
 *     <DashboardRoute />
 *     <ProjectEditRoute />
 *   </AppShellRoute>
 * </Router>
 */
export function createRoute<const Path extends string>(
  path: Path,
  config: CreateRouteConfig
): TypedRoute<PathParams<Path>, Record<string, never>>;
export function createRoute<P extends Record<string, string>, Q extends Record<string, string | undefined> = Record<string, never>>(
  path: string,
  config: CreateRouteConfig
): TypedRoute<P, Q>;
export function createRoute(
  path: string,
  config: CreateRouteConfig
): TypedRoute<Record<string, string>, Record<string, string | undefined>> {
  // Function body never actually executes at runtime — the Router scans its
  // children for TYPED_ROUTE_MARKER and extracts config off the function
  // itself. The body is a fallback for someone who renders the component
  // outside a Router; it produces the same JSX a raw <Route> would.
  const fn = (props?: { children?: JSXElement | JSXElement[] }) =>
    jsx(Route as unknown as Component, {
      path,
      component: config.component,
      beforeEnter: config.beforeEnter,
      load: config.load,
      transition: config.transition,
      ...(props?.children !== undefined ? { children: props.children } : {})
    });
  Object.assign(fn, {
    [TYPED_ROUTE_MARKER]: true,
    path,
    component: config.component,
    beforeEnter: config.beforeEnter,
    load: config.load,
    transition: config.transition
  });
  return fn as unknown as TypedRoute<Record<string, string>, Record<string, string | undefined>>;
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
  const chains = flattenRoutes(Array.isArray(routes) ? routes : [routes]);
  const router = createRouter(url);
  router._chains = chains;

  const redirect = await router._runGuardsAndLoad(url);
  if (redirect !== null) {
    throw new RedirectError(redirect);
  }

  // Re-apply location now that chains are set so params resolve correctly.
  // createRouter() initializes location before chains are registered, so params
  // would be {} without this call.
  router._setLocation(url);

  return router;
}
