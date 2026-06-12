// router.ts — router context + navigation

import { signal, reactiveScope, store, createContext } from '@stewie-js/core';
import type { Signal } from '@stewie-js/core';
import { consume } from '@stewie-js/core';
import { createLocationStore, parseUrl } from './location.js';
import type { RouterStore } from './location.js';
import type { StewieRouterSPI, NavigateOptions, RouteMatch, NavigationStatus, NavigationKind, RouteDirection } from '@stewie-js/router-spi';
import { matchRoute } from './matcher.js';

// ---------------------------------------------------------------------------
// Browser API feature detection
// ---------------------------------------------------------------------------

/**
 * Run `fn` inside a View Transition, passing the optional `types` array so
 * CSS can match `:active-view-transition-type(stewie-…)` selectors. Falls
 * back to a direct call when `startViewTransition` is unavailable (no DOM,
 * non-Chromium browsers).
 */
function withViewTransition(fn: () => void, types?: string[]): void {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    if (types && types.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition({ update: fn, types });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition(fn);
    }
  } else {
    fn();
  }
}

/**
 * Compute the structural direction of a navigation by comparing source and
 * destination chains. Structural, not perceptual — see {@link RouteDirection}.
 */
function computeRouteDirection(source: FlatRouteChain | null, dest: FlatRouteChain): RouteDirection {
  if (!source) return 'default';
  if (source === dest || source.leafPath === dest.leafPath) return 'same';
  const s = source.levels;
  const d = dest.levels;
  const minLen = Math.min(s.length, d.length);
  let sharedPrefix = 0;
  for (let i = 0; i < minLen; i++) {
    if (s[i].fullPath === d[i].fullPath) sharedPrefix++;
    else break;
  }
  if (sharedPrefix === s.length && s.length < d.length) return 'forward';
  if (sharedPrefix === d.length && d.length < s.length) return 'back';
  return 'default';
}

/**
 * Build the View Transition `types` array for a navigation.
 * Always emits `stewie-kind-{kind}` and `stewie-direction-{direction}`.
 * Emits `stewie-transition-{group}` only when both chains contain a level
 * with the same `transition` and direction is forward or back — sibling
 * (default) and param-only (same) moves don't trigger group transitions.
 * The innermost (deepest) shared group wins.
 */
function computeVTTypes(
  kind: NavigationKind,
  direction: RouteDirection,
  source: FlatRouteChain | null,
  dest: FlatRouteChain | null
): string[] {
  const types: string[] = [`stewie-kind-${kind}`, `stewie-direction-${direction}`];
  if ((direction === 'forward' || direction === 'back') && source && dest) {
    const srcGroups = new Set<string>();
    for (const l of source.levels) if (l.transition) srcGroups.add(l.transition);
    // Walk destination from leaf to root so the innermost shared group wins.
    for (let i = dest.levels.length - 1; i >= 0; i--) {
      const g = dest.levels[i].transition;
      if (g && srcGroups.has(g)) {
        types.push(`stewie-transition-${g}`);
        break;
      }
    }
  }
  return types;
}

/** Trigger `.preload()` on any lazy components in the chain. Resolves once all complete. */
function awaitLazyChunks(chain: FlatRouteChain): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const level of chain.levels) {
    const comp = level.component as unknown as { preload?: () => Promise<void> };
    if (typeof comp?.preload === 'function') promises.push(comp.preload());
  }
  return promises.length === 0 ? Promise.resolve() : Promise.all(promises).then(() => undefined);
}

/**
 * Save the current window scroll position into the current history entry's
 * state, so a later traverse can restore it. No-op outside the browser.
 */
function saveCurrentScroll(): void {
  if (typeof globalThis.history === 'undefined' || typeof globalThis.window === 'undefined') return;
  const cur = globalThis.history.state as Record<string, unknown> | null;
  const next = {
    ...cur,
    _stewie_scroll: [globalThis.window.scrollX, globalThis.window.scrollY] as [number, number]
  };
  try {
    globalThis.history.replaceState(next, '');
  } catch {
    // history.state is read-only or replaceState rejected — give up silently
  }
}

/**
 * Apply scroll behavior for a navigation. Called inside the VT update
 * callback so the scroll lands on the post-commit DOM in the same task.
 *
 * - traverse → restore from history state
 * - hash present → scrollIntoView on matching element
 * - otherwise (forward push/replace/reload) → scroll to (0, 0)
 */
function applyScrollBehavior(kind: NavigationKind, hash: string): void {
  if (typeof globalThis.window === 'undefined') return;
  if (kind === 'traverse') {
    const state = (globalThis.history?.state as Record<string, unknown> | null) ?? null;
    const saved = state?._stewie_scroll as [number, number] | undefined;
    if (saved) {
      globalThis.window.scrollTo(saved[0], saved[1]);
      return;
    }
    // Fall through: no saved position, default to top.
  }
  if (hash) {
    const el = typeof document !== 'undefined' ? document.getElementById(hash) : null;
    if (el) {
      el.scrollIntoView();
      return;
    }
  }
  globalThis.window.scrollTo(0, 0);
}

/** Returns true if the Navigation API is available in this environment. */
function hasNavigationApi(): boolean {
  return typeof (globalThis as Record<string, unknown>)['navigation'] !== 'undefined';
}

// ---------------------------------------------------------------------------
// Route guard types
// ---------------------------------------------------------------------------

/**
 * A route guard called before navigation completes.
 * Return `true` to allow navigation, or a redirect URL string to redirect instead.
 */
export type RouteGuard = (to: string, from: string) => Promise<true | string> | (true | string);

// ---------------------------------------------------------------------------
// RedirectError — thrown by createSsrRouter when a guard redirects
// ---------------------------------------------------------------------------

/**
 * Thrown by `createSsrRouter` when a `beforeEnter` guard returns a redirect URL.
 * Catch this in your SSR request handler and return an HTTP 302 response.
 *
 * ```ts
 * try {
 *   const router = await createSsrRouter(req.url, routeElements)
 *   const { html, stateScript } = await renderToString(<App router={router} />)
 *   return new Response(html + stateScript, { headers: { 'content-type': 'text/html' } })
 * } catch (err) {
 *   if (err instanceof RedirectError) {
 *     return new Response(null, { status: 302, headers: { location: err.location } })
 *   }
 *   throw err
 * }
 * ```
 */
export class RedirectError extends Error {
  constructor(public readonly location: string) {
    super(`SSR redirect to ${location}`);
    this.name = 'RedirectError';
  }
}

// ---------------------------------------------------------------------------
// Flat route chain types
// ---------------------------------------------------------------------------

/** One level in a matched route chain (layout or leaf). */
export interface RouteChainLevel {
  /** Concatenated full path for this level (e.g. '/projects' for layout, '/projects/:id' for leaf). */
  fullPath: string;
  component: unknown;
  beforeEnter?: RouteGuard;
  load?: (params: Record<string, string>, query: Record<string, string>) => Promise<unknown>;
  /** Transition group name declared on the route at this level, if any. */
  transition?: string;
}

/**
 * A fully-flattened route chain from root to leaf.
 * Each entry in `levels` is one nesting depth; `leafPath` is the full
 * concatenated path of the deepest level (used for matching).
 */
export interface FlatRouteChain {
  /** Full concatenated path of the leaf (used as the pattern for matchRoute). */
  leafPath: string;
  levels: RouteChainLevel[];
}

// ---------------------------------------------------------------------------
// Outlet context — tracks the matched chain and current rendering depth
// ---------------------------------------------------------------------------

export interface OutletContextValue {
  /** The currently matched flat route chain. */
  chain: FlatRouteChain;
  /** The depth of the level currently being rendered (0 = root). */
  depth: number;
}

/**
 * Context providing the current matched chain and depth to `<Outlet />` and
 * `useRouteData()`. Established by the Router at the root (depth=0) and bumped
 * by each `<Outlet />` before rendering the next level's component.
 */
export const OutletContext = createContext<OutletContextValue | null>(null);

/** Internal route config stored on the router (includes guards and load fn). */
export interface RouterRouteConfig {
  path: string;
  component: unknown;
  beforeEnter?: RouteGuard;
  load?: (params: Record<string, string>, query: Record<string, string>) => Promise<unknown>;
}

export interface Router extends StewieRouterSPI {
  // Internal: update location store with optional explicit params
  _setLocation(url: string, params?: Record<string, string>): void;
  // Internal: flat route chains (set by Router component after flattening)
  _chains: FlatRouteChain[];
  /**
   * @deprecated Internal compatibility shim. Use _chains for nested routes.
   * Setting _routes converts each entry to a single-level FlatRouteChain.
   */
  _routes: RouterRouteConfig[];
  // Internal: per-level data signals keyed by fullPath of each chain level
  _routeDataMap: Map<string, Signal<unknown>>;
  // Internal: the chain currently committed to the location store, used as
  // the source for routeDirection computation on the next navigation.
  _currentChain: FlatRouteChain | null;
  // Internal: remove browser event listeners attached by createRouter()
  _dispose(): void;
  // Internal: run guards + loader for the given URL, returns redirect URL or null
  _runGuardsAndLoad(url: string): Promise<string | null>;
}

export const RouterContext = createContext<Router | null>(null);

export function createRouter(initialUrl?: string): Router {
  // _routeDataMap is created inside reactiveScope() so signal creation is allowed.
  const _routeDataMap = new Map<string, Signal<unknown>>();

  const location: RouterStore = createLocationStore(initialUrl ?? '/');

  const status: NavigationStatus = reactiveScope(() => store<NavigationStatus>({ phase: 'idle' }));

  /** Compute params for a URL against the registered chains. */
  function resolveParams(pathname: string): Record<string, string> {
    let params: Record<string, string> = {};
    let bestScore = -1;
    for (const chain of router._chains) {
      const result = matchRoute(chain.leafPath, pathname);
      if (result && result.score > bestScore) {
        params = result.params;
        bestScore = result.score;
      }
    }
    return params;
  }

  /** Apply a parsed URL to the reactive location store.
   *
   * Each field is written only when its value actually changes. The store
   * notifies subscribers on every assignment regardless of equality, so
   * blindly re-writing identical values would re-trigger `matchedContent`
   * and re-mount the route component for query-only or hash-only
   * navigations. This guard is what lets query updates ride through
   * `navigate()` without losing input focus on the matched page.
   */
  function applyLocation(url: string, params?: Record<string, string>): void {
    const parsed = parseUrl(url);
    if (location.pathname !== parsed.pathname) {
      location.pathname = parsed.pathname;
    }
    if (!shallowEqualQuery(location.query, parsed.query)) {
      location.query = parsed.query;
    }
    if (location.hash !== parsed.hash) {
      location.hash = parsed.hash;
    }
    const nextParams = params ?? resolveParams(parsed.pathname);
    if (!shallowEqualQuery(location.params, nextParams)) {
      location.params = nextParams;
    }
  }

  /** Cheap equality for the flat string maps used by query and params. */
  function shallowEqualQuery(a: Record<string, string>, b: Record<string, string>): boolean {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  }

  /** Ensure a signal exists in _routeDataMap for the given key and return it. */
  function getOrCreateDataSignal(key: string): Signal<unknown> {
    let sig = _routeDataMap.get(key);
    if (!sig) {
      reactiveScope(() => {
        sig = signal<unknown>(undefined);
      });
      _routeDataMap.set(key, sig!);
    }
    return _routeDataMap.get(key)!;
  }

  interface PreparedChain {
    chain: FlatRouteChain;
    params: Record<string, string>;
  }

  /**
   * Find the best-matching chain for a URL and run its guards (outermost→inner)
   * and loaders (in parallel). Returns the prepared chain, `{ redirect }` if
   * a guard blocked, or `null` if nothing matched.
   */
  async function runGuardsAndLoad(url: string, updateStatus = true): Promise<PreparedChain | { redirect: string } | null> {
    const parsed = parseUrl(url);

    if (updateStatus) {
      status.phase = 'matching';
      status.from = location.pathname;
      status.to = parsed.pathname;
    }

    // Find best-matching chain
    let bestChain: FlatRouteChain | null = null;
    let bestScore = -1;
    let matchedParams: Record<string, string> = {};
    for (const chain of router._chains) {
      const result = matchRoute(chain.leafPath, parsed.pathname);
      if (result && result.score > bestScore) {
        bestChain = chain;
        bestScore = result.score;
        matchedParams = result.params;
      }
    }

    if (!bestChain) {
      if (updateStatus) status.phase = 'idle';
      return null;
    }

    // Run beforeEnter guards outermost → inner; first redirect wins.
    for (const level of bestChain.levels) {
      if (level.beforeEnter) {
        if (updateStatus) status.phase = 'guarding';
        const result = await level.beforeEnter(url, location.pathname);
        if (result !== true) {
          if (updateStatus) status.phase = 'idle';
          return { redirect: result as string };
        }
      }
    }

    // Reset ALL per-level data signals before loading the new chain.
    // This ensures stale data from a previous route does not bleed through
    // when navigating to a route whose path has a different fullPath key.
    // Skipped during preload: nothing is committed, and a preload writing to
    // the registry is the entire point of warming the cache.
    if (updateStatus) {
      status.phase = 'loading';
      for (const sig of _routeDataMap.values()) {
        sig.set(undefined);
      }
    }

    // Run loaders in parallel. Both paths run them: navigate awaits before
    // committing; preload awaits so the caller (Link hover) can chain on the
    // returned promise.
    const loadPromises = bestChain.levels
      .filter((level) => level.load)
      .map(async (level) => {
        const data = await level.load!(matchedParams, parsed.query);
        getOrCreateDataSignal(level.fullPath).set(data);
      });
    await Promise.all(loadPromises);

    return { chain: bestChain, params: matchedParams };
  }

  // Holds the cleanup function for browser event listeners.
  let _listenersDisposer = () => {};

  // Set true while `setQuery` calls into `history.*` so the Navigation API
  // `navigate` listener (which would otherwise re-run guards and loaders for
  // a same-document history mutation) treats this nav as a no-op.
  let _suppressNavListener = false;

  // Programmatic navigation handoff to the Navigation API listener: navigate()
  // has already run guards/loaders/lazy-await; the listener should commit
  // using these prepared values without redoing the work. Cleared by the
  // listener on consumption (whether it ran the handler or not).
  let _pendingProgrammaticChain: FlatRouteChain | null = null;
  let _pendingProgrammaticParams: Record<string, string> | undefined = undefined;
  let _pendingProgrammaticKind: NavigationKind | null = null;
  let _pendingProgrammaticScroll = true;

  // Set the browser's scroll restoration to manual so the router owns it.
  // Without this, browsers automatically restore scroll on history navigations
  // before the new route's content is rendered, which is visually awful.
  if (typeof globalThis.history !== 'undefined' && 'scrollRestoration' in globalThis.history) {
    try {
      globalThis.history.scrollRestoration = 'manual';
    } catch {
      // Read-only in some test stubs; nothing to do.
    }
  }

  /**
   * Commit a navigation: write to the reactive location store, update
   * browser history (if requested), apply scroll behavior, and run all of
   * the above inside a View Transition with the right `types` so CSS can
   * branch on kind / direction / transition group.
   */
  function commit(opts: {
    url: string;
    params?: Record<string, string>;
    kind: NavigationKind;
    destChain: FlatRouteChain | null;
    /** 'push' / 'replace' to write history; null to leave history untouched (Navigation API already wrote it). */
    historyMode: 'push' | 'replace' | null;
    scroll: boolean;
  }): void {
    const sourceChain = router._currentChain;
    const direction: RouteDirection = opts.destChain ? computeRouteDirection(sourceChain, opts.destChain) : 'default';
    status.kind = opts.kind;
    status.routeDirection = direction;
    const types = computeVTTypes(opts.kind, direction, sourceChain, opts.destChain);

    // Stash the current scroll position into the outgoing history entry, but
    // only when we're about to push a new one. Replace and traverse don't
    // need this — replace overwrites the current entry, traverse is already
    // moving to an entry that has (or doesn't have) its own saved state.
    if (opts.scroll && opts.historyMode === 'push') saveCurrentScroll();

    const hash = parseUrl(opts.url).hash;
    withViewTransition(() => {
      applyLocation(opts.url, opts.params);
      if (opts.scroll) applyScrollBehavior(opts.kind, hash);
    }, types);

    if (opts.historyMode && typeof globalThis.history !== 'undefined') {
      if (opts.historyMode === 'push') {
        globalThis.history.pushState(null, '', opts.url);
      } else {
        globalThis.history.replaceState(null, '', opts.url);
      }
    }

    router._currentChain = opts.destChain;
  }

  const router: Router = {
    location,
    status,
    _chains: [],
    _routeDataMap,
    _currentChain: null,

    // Compatibility shim: setting _routes converts to single-level chains.
    set _routes(configs: RouterRouteConfig[]) {
      router._chains = configs.map((cfg) => ({
        leafPath: cfg.path,
        levels: [
          {
            fullPath: cfg.path,
            component: cfg.component,
            beforeEnter: cfg.beforeEnter,
            load: cfg.load
          }
        ]
      }));
    },
    get _routes(): RouterRouteConfig[] {
      // Reconstruct a flat list from chains for backward compat reads.
      return router._chains.map((chain) => {
        const leaf = chain.levels[chain.levels.length - 1];
        return {
          path: chain.leafPath,
          component: leaf.component,
          beforeEnter: leaf.beforeEnter,
          load: leaf.load
        };
      });
    },

    _dispose() {
      _listenersDisposer();
    },

    _runGuardsAndLoad(url: string): Promise<string | null> {
      return runGuardsAndLoad(url).then((result) => {
        if (result === null) return null;
        if ('redirect' in result) return result.redirect;
        return null;
      });
    },

    navigate(to: string | NavigateOptions): Promise<void> {
      const url = typeof to === 'string' ? to : to.to;
      const replace = typeof to !== 'string' && !!to.replace;
      const scroll = typeof to === 'string' ? true : to.scroll !== false;
      const kind: NavigationKind = replace ? 'replace' : 'push';

      // Synchronous fast path — no guards or loaders registered on any chain level.
      const hasGuardsOrLoaders = router._chains.some((chain) => chain.levels.some((l) => l.beforeEnter || l.load));
      if (!hasGuardsOrLoaders) {
        // Match the destination chain so kind/direction/VT-types are still
        // computed even on the no-guard fast path. Eager components have no
        // .preload() so the await is a no-op.
        const parsed = parseUrl(url);
        let destChain: FlatRouteChain | null = null;
        let bestScore = -1;
        let matchedParams: Record<string, string> = {};
        for (const chain of router._chains) {
          const r = matchRoute(chain.leafPath, parsed.pathname);
          if (r && r.score > bestScore) {
            destChain = chain;
            bestScore = r.score;
            matchedParams = r.params;
          }
        }
        status.phase = 'committing';
        status.from = location.pathname;
        status.to = url;
        if (hasNavigationApi()) {
          // Navigation API path: hand off to navigation.navigate and let the
          // listener commit. Set the chain so the listener's commit() sees it.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).navigation.navigate(url, { history: replace ? 'replace' : 'push' });
        } else {
          commit({ url, params: matchedParams, kind, destChain, historyMode: replace ? 'replace' : 'push', scroll });
        }
        status.phase = 'idle';
        return Promise.resolve();
      }

      // Async path — run guards and loaders, await lazy chunks, then commit.
      return (async () => {
        try {
          const result = await runGuardsAndLoad(url);
          if (result === null) return;
          if ('redirect' in result) {
            // Redirect to the guard's target with replace semantics so the
            // history doesn't accumulate "/private → /login" pairs. The
            // recursive call's kind becomes 'replace', which matches "the
            // engine swapped the destination underneath you."
            return router.navigate({ to: result.redirect, replace: true, scroll });
          }

          status.phase = 'committing';
          // Warm any lazy chunks in the destination chain BEFORE
          // startViewTransition, so the new DOM is present when the
          // transition snapshots the post-update state. Without this, the VT
          // would snapshot an empty boundary and then animate to nothing.
          await awaitLazyChunks(result.chain);

          if (hasNavigationApi()) {
            // Navigation API path: hand off to navigation.navigate; the
            // listener will commit. Stash the prepared chain so the listener
            // doesn't re-do work.
            _pendingProgrammaticChain = result.chain;
            _pendingProgrammaticParams = result.params;
            _pendingProgrammaticKind = kind;
            _pendingProgrammaticScroll = scroll;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).navigation.navigate(url, { history: replace ? 'replace' : 'push' });
          } else {
            commit({
              url,
              params: result.params,
              kind,
              destChain: result.chain,
              historyMode: replace ? 'replace' : 'push',
              scroll
            });
          }
          status.phase = 'idle';
        } catch (err) {
          status.phase = 'error';
          throw err;
        }
      })();
    },

    setQuery(patch, options) {
      const push = options?.push ?? false;
      const merged: Record<string, string> = { ...location.query };
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined) {
          delete merged[key];
        } else {
          merged[key] = value;
        }
      }

      if (shallowEqualQuery(location.query, merged)) {
        return;
      }

      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(merged)) {
        params.set(k, v);
      }
      const search = params.toString();
      const url = location.pathname + (search ? `?${search}` : '') + (location.hash ? `#${location.hash}` : '');

      _suppressNavListener = true;
      try {
        if (typeof globalThis.history !== 'undefined') {
          if (push) {
            globalThis.history.pushState(null, '', url);
          } else {
            globalThis.history.replaceState(null, '', url);
          }
        }
      } finally {
        _suppressNavListener = false;
      }

      location.query = merged;
    },

    dismiss() {
      // Dismiss the current overlay/dialog by going back in history.
      // When a richer overlay routing model is in place this will pop the
      // overlay stack rather than delegating to browser history.
      router.back();
    },

    back() {
      if (hasNavigationApi()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).navigation.back();
      } else if (typeof globalThis.history !== 'undefined') {
        globalThis.history.back();
      }
    },

    forward() {
      if (hasNavigationApi()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).navigation.forward();
      } else if (typeof globalThis.history !== 'undefined') {
        globalThis.history.forward();
      }
    },

    match(pattern: string): RouteMatch | null {
      const result = matchRoute(pattern, location.pathname);
      if (!result) return null;
      return { pattern, params: result.params, score: result.score };
    },

    async preload(to: string | NavigateOptions): Promise<void> {
      const url = typeof to === 'string' ? to : to.to;
      // Kick off the lazy chunk download in parallel with guard/loader execution.
      // Both deduplicate internally: a Link hovered many times still triggers
      // exactly one fetch per route.
      const parsed = parseUrl(url);
      let bestChain: FlatRouteChain | null = null;
      let bestScore = -1;
      for (const chain of router._chains) {
        const result = matchRoute(chain.leafPath, parsed.pathname);
        if (result && result.score > bestScore) {
          bestChain = chain;
          bestScore = result.score;
        }
      }
      const chunkPromise = bestChain ? awaitLazyChunks(bestChain) : Promise.resolve();
      // Guards and loaders run with updateStatus=false so the current view is
      // unaffected. The result (matched chain or redirect) is discarded — we
      // ran them for cache-warming side effects, not for control flow.
      await Promise.all([runGuardsAndLoad(url, false), chunkPromise]);
    },

    _setLocation(url: string, params?: Record<string, string>) {
      applyLocation(url, params);
    }
  };

  // ---------------------------------------------------------------------------
  // Browser history listeners
  // ---------------------------------------------------------------------------

  if (typeof globalThis.addEventListener === 'function' && typeof globalThis.location !== 'undefined') {
    if (hasNavigationApi()) {
      // Navigation API: fires for ALL navigations including back/forward,
      // so we don't also need a popstate listener.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navHandler = (event: any) => {
        if (_suppressNavListener) return;
        if (!event.canIntercept || event.hashChange || event.downloadRequest !== null) return;
        const destUrl = new URL(event.destination.url);
        const destPath = destUrl.pathname + destUrl.search + destUrl.hash;
        // The Navigation API exposes a precise navigationType — trust it for
        // `kind`, falling back to 'push' if absent (older browsers).
        const eventKind: NavigationKind = (event.navigationType as NavigationKind) ?? 'push';

        event.intercept({
          // event.userInitiated is true for browser-UI navigations (back/forward
          // button, address bar, link clicks the browser handles natively).
          // It is false for programmatic navigation.navigate() calls — those
          // come from our own navigate() which already ran guards + awaited
          // lazy chunks and stashed the prepared chain in _pendingProgrammatic*.
          handler: event.userInitiated
            ? async () => {
                const result = await runGuardsAndLoad(destPath);
                if (result === null) return;
                if ('redirect' in result) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (globalThis as any).navigation.navigate(result.redirect, { history: 'replace' });
                  return;
                }
                await awaitLazyChunks(result.chain);
                commit({
                  url: destPath,
                  params: result.params,
                  kind: eventKind,
                  destChain: result.chain,
                  // Navigation API already wrote history; don't double-write.
                  historyMode: null,
                  scroll: true
                });
              }
            : () => {
                // Programmatic path — navigate() already prepared the chain
                // and awaited any lazy chunks. Apply with the stashed values.
                const destChain = _pendingProgrammaticChain;
                const params = _pendingProgrammaticParams;
                const kind = _pendingProgrammaticKind ?? eventKind;
                const scroll = _pendingProgrammaticScroll;
                _pendingProgrammaticChain = null;
                _pendingProgrammaticParams = undefined;
                _pendingProgrammaticKind = null;
                _pendingProgrammaticScroll = true;
                commit({
                  url: destPath,
                  params,
                  kind,
                  destChain,
                  historyMode: null,
                  scroll
                });
              }
        });
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).navigation.addEventListener('navigate', navHandler);
      _listenersDisposer = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).navigation.removeEventListener('navigate', navHandler);
      };
    } else {
      // History API fallback: popstate fires on back/forward button.
      // Run guards before applying the new location so that auth redirects
      // and data loaders work on browser back/forward navigation.
      const popHandler = () => {
        const url = globalThis.location.pathname + globalThis.location.search + globalThis.location.hash;
        (async () => {
          const result = await runGuardsAndLoad(url);
          if (result === null) return;
          if ('redirect' in result) {
            // Re-enter navigate() so the redirect target's own guards and
            // loaders run, rather than bypassing them with a bare location push.
            await router.navigate({ to: result.redirect, replace: true });
            return;
          }
          await awaitLazyChunks(result.chain);
          commit({
            url,
            params: result.params,
            kind: 'traverse',
            destChain: result.chain,
            // popstate fired because history already moved; don't write again.
            historyMode: null,
            scroll: true
          });
        })();
      };
      globalThis.addEventListener('popstate', popHandler);
      _listenersDisposer = () => {
        globalThis.removeEventListener('popstate', popHandler);
      };
    }
  }

  return router;
}

export function useRouter(): Router {
  const router = consume(RouterContext);
  if (!router) throw new Error('useRouter() called outside of <Router> provider');
  return router;
}
