// @stewie-js/router-spi — router interface definitions
export const version = '0.8.0';

export interface ReactiveLocation {
  pathname: string;
  params: Record<string, string>;
  query: Record<string, string>;
  hash: string;
}

export interface NavigateOptions {
  to: string;
  replace?: boolean;
  state?: unknown;
}

/**
 * Patch shape for {@link StewieRouterSPI.setQuery}. A `string` value sets or
 * replaces the key; `null` or `undefined` deletes it.
 */
export type QueryPatch = Record<string, string | null | undefined>;

export interface SetQueryOptions {
  /**
   * Use `history.pushState` instead of the default `history.replaceState`.
   * Defaults to `false` — query updates usually shouldn't add a history
   * entry per keystroke, but multi-step filter flows may want a back-button.
   */
  push?: boolean;
  /**
   * Re-run the matched chain's route loaders with the new query.
   *
   * Defaults to `true` because query params commonly identify the resource
   * (e.g. `/product?productId=…`) or drive server-side filtering — in both
   * cases the loader needs the new value. Pass `false` for client-side live
   * search or pure UI state in the URL, where the page reads `useQuery()`
   * reactively and the loader does not depend on the changing keys.
   *
   * Guards are never re-run; query updates do not cross an auth boundary.
   * The route component never re-mounts either way — only `useRouteData()`
   * and `useQuery()` subscribers see the change.
   */
  loaders?: boolean;
}

export interface RouteMatch {
  pattern: string;
  params: Record<string, string>;
  score: number;
}

/**
 * Lifecycle phase of an in-flight navigation.
 *
 * - `idle`      — no navigation in progress
 * - `matching`  — resolving the destination route
 * - `guarding`  — running `beforeEnter` guards
 * - `loading`   — running the route `load()` function
 * - `committing`— applying the new location to the reactive store
 * - `error`     — navigation failed (guard threw, load threw, etc.)
 */
export type NavigationPhase = 'idle' | 'matching' | 'guarding' | 'loading' | 'committing' | 'error';

/**
 * Reactive object describing the current navigation state.
 * Implementations expose this as a reactive store so that components can
 * subscribe to phase changes (e.g. to show a progress indicator).
 */
export interface NavigationStatus {
  phase: NavigationPhase;
  /** URL being navigated away from, set when a navigation begins. */
  from?: string;
  /** URL being navigated to, set when a navigation begins. */
  to?: string;
}

export interface StewieRouterSPI {
  readonly location: ReactiveLocation;
  /** Reactive navigation lifecycle status. */
  readonly status: NavigationStatus;
  navigate(to: string | NavigateOptions): Promise<void>;
  /**
   * Patch the URL's query string and reactive `location.query` without
   * re-mounting the matched route component.
   *
   * By default the matched chain's loaders re-run with the new query —
   * this matches the common case where the query identifies the resource
   * (`/product?id=…`) or drives server-side filtering. Pass
   * `{ loaders: false }` for client-side live search or pure UI state in
   * the URL where the page reads `useQuery()` reactively and the loader
   * does not depend on the changing keys.
   *
   * Guards do not run. The route component does not re-mount. The
   * returned promise resolves once any pending loaders finish; callers
   * who don't care can ignore it.
   *
   * @example
   *   // server-driven filter (loader re-runs):
   *   router.setQuery({ status: 'archived' });
   *   // identity swap (loader re-runs):
   *   router.setQuery({ productId: '12345' });
   *   // client-side live search (skip loader rerun):
   *   onInput={(e) => router.setQuery({ q: e.target.value }, { loaders: false })}
   *   // delete a key:
   *   router.setQuery({ category: null });
   */
  setQuery(patch: QueryPatch, options?: SetQueryOptions): Promise<void>;
  /**
   * Dismiss the current overlay/dialog destination and return to the
   * underlying view. Behaves like `back()` when no overlay model is active.
   */
  dismiss(): void;
  back(): void;
  forward(): void;
  match(pattern: string): RouteMatch | null;
  /**
   * Prefetch a destination: run its guards and load function without
   * committing the navigation. Useful for hover-to-preload patterns.
   */
  preload(to: string | NavigateOptions): Promise<void>;
}
