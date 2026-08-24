// hooks.ts — router utility functions

import { consume } from '@stewie-js/core';
import { useRouter } from './router.js';
import { OutletContext } from './router.js';
import type { OutletContextValue } from './router.js';
import { matchRoute } from './matcher.js';
import type { RouterStore } from './location.js';
import type { NavigationStatus } from '@stewie-js/router-spi';
import type { ParamsOf, QueryOf, TypedRoute } from './typed-routes.js';

export function useLocation(): RouterStore {
  return useRouter().location as RouterStore;
}

/**
 * Wrap a store-backed flat string map in a view that re-resolves the map on
 * every property access.
 *
 * `location.query` and `location.params` are replaced wholesale on navigation
 * (`location.query = parsed.query`). Returning the object itself would hand the
 * caller a reference to whichever object was current at call time: the store
 * notifies only the exact path that was written (`query`), never its
 * descendants (`query.id`), and the captured proxy stays bound to the old raw
 * target — so a consumer that did `const q = useQuery()` at setup would read
 * stale values forever, even though a fresh `location.query.id` read is
 * correct.
 *
 * Re-reading `read()` inside each trap fixes both halves: it subscribes to the
 * parent path (which *is* notified on replacement) and it resolves against the
 * current object.
 */
function liveView<T extends Record<string, string | undefined>>(read: () => Record<string, string>): T {
  return new Proxy({} as T, {
    get(_target, key) {
      if (typeof key === 'symbol') return undefined;
      return read()[key];
    },
    has(_target, key) {
      if (typeof key === 'symbol') return false;
      return key in read();
    },
    ownKeys() {
      return Reflect.ownKeys(read());
    },
    getOwnPropertyDescriptor(_target, key) {
      if (typeof key === 'symbol') return undefined;
      const current = read();
      if (!(key in current)) return undefined;
      // Must be configurable: the proxy target is an empty object, and a
      // non-configurable report for a property the target lacks is a
      // TypeError under the proxy invariants.
      return { value: current[key], enumerable: true, configurable: true, writable: true };
    }
  });
}

/**
 * Returns the matched route's URL params.
 *
 * Three call shapes are supported:
 *
 * ```ts
 * // Value form — preferred. Pass the route value from createRoute().
 * const { projectId } = useParams(ProjectDetailRoute);
 *
 * // Generic form — for hand-written RouteDefinition or bare param shapes.
 * const { projectId } = useParams<ProjectDetailRoute>();
 * const { projectId } = useParams<{ projectId: string }>();
 * ```
 *
 * The argument is a phantom-type carrier; it is ignored at runtime.
 *
 * Params are fixed for the lifetime of the component, so destructuring is
 * safe. They derive from the pathname, and a pathname change re-mounts the
 * route component — `/users/1` → `/users/2` yields a new component instance
 * rather than mutating the old one. Contrast `useQuery`, which is reactive
 * because `setQuery` deliberately does not re-mount.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useParams<R extends TypedRoute<any, any>>(route: R): NonNullable<R['__params']>;
export function useParams<T = Record<string, string>>(): ParamsOf<T>;
export function useParams(_route?: unknown): unknown {
  const router = useRouter();

  // Prefer the params captured for this render. They are frozen for the life
  // of the component instance, which is correct: params derive from the
  // pathname, and a pathname change re-mounts the route component, so a
  // mounted component never needs to observe a param change. Reading the live
  // store instead let an *outgoing* component's computeds re-run with the
  // incoming route's params before that subtree was disposed.
  let ctx: OutletContextValue | null = null;
  try {
    ctx = consume(OutletContext);
  } catch {
    // Not inside a route render (e.g. called directly under <Router>).
  }
  if (ctx) return ctx.params;

  // Fallback for callers outside a matched route render.
  return liveView(() => router.location.params);
}

/**
 * Returns the current URL's query params. Accepts the same three call shapes
 * as `useParams` — value form (preferred), legacy generic, or bare shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useQuery<R extends TypedRoute<any, any>>(route: R): NonNullable<R['__query']>;
export function useQuery<T = Record<string, string | undefined>>(): QueryOf<T>;
export function useQuery(_route?: unknown): unknown {
  const router = useRouter();
  return liveView(() => router.location.query);
}

/**
 * Returns the data loaded by the current route's `load()` function.
 *
 * In a nested route tree, each layout and leaf gets its own data from its
 * own loader. `useRouteData()` returns data for the component's nesting
 * depth as determined by the nearest `OutletContext`.
 *
 * In a flat route tree (no layouts), it returns the leaf route's data as
 * before.
 *
 * Reactive — re-reads when navigation loads new data.
 */
export function useRouteData<T = unknown>(): T {
  const router = useRouter();

  // Read the current nesting depth from OutletContext to look up the right level.
  let ctx: OutletContextValue | null = null;
  try {
    ctx = consume(OutletContext);
  } catch {
    // No OutletContext — fall back to best-matched leaf
  }

  if (ctx) {
    const level = ctx.chain.levels[ctx.depth];
    if (level) {
      const sig = router._routeDataMap.get(level.fullPath);
      if (sig) return sig() as T;
    }
    return undefined as T;
  }

  // Fallback: no OutletContext (flat routes or called outside router context).
  // Return the leaf's data from the best-matched chain.
  const pathname = router.location.pathname;
  let bestSig: ReturnType<typeof router._routeDataMap.get> | undefined;
  let bestScore = -1;
  for (const chain of router._chains) {
    const result = matchRoute(chain.leafPath, pathname);
    if (result && result.score > bestScore) {
      bestScore = result.score;
      const leaf = chain.levels[chain.levels.length - 1];
      bestSig = router._routeDataMap.get(leaf.fullPath);
    }
  }
  return (bestSig ? bestSig() : undefined) as T;
}

/**
 * Returns the reactive navigation status object.
 * Subscribe to `status.phase` to show a progress indicator during navigation.
 */
export function useNavigationStatus(): NavigationStatus {
  return useRouter().status;
}
