// @stewie-js/router-spi — router interface definitions
export const version = '0.7.0';

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
