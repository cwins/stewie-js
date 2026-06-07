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
   * Patch the URL's query string and reactive `location.query` synchronously,
   * without re-mounting the matched route component and without re-running
   * guards or loaders. `useQuery()` subscribers see the new value
   * immediately.
   *
   * For data that needs to refetch when query changes, declare the
   * dependency at the fetch site:
   *
   *   const data = useResource(fetchProduct, () => location.query.productId);
   *
   * Loaders only run on `navigate()` (i.e. across guard boundaries).
   *
   * @example
   *   // Live search / filter — pure URL state:
   *   router.setQuery({ q: e.target.value });
   *   // Multi-step filter that wants a back-button entry:
   *   router.setQuery({ status: 'archived' }, { push: true });
   *   // Delete a key:
   *   router.setQuery({ category: null });
   */
  setQuery(patch: QueryPatch, options?: SetQueryOptions): void;
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
