// router.ts — router context + navigation

import { signal, createRoot } from '@stewie-js/core'
import type { Signal } from '@stewie-js/core'
import { createContext, inject } from '@stewie-js/core'
import { createLocationStore, parseUrl } from './location.js'
import type { RouterStore } from './location.js'
import type { StewieRouterSPI, NavigateOptions, RouteMatch } from '@stewie-js/router-spi'
import { matchRoute } from './matcher.js'

// ---------------------------------------------------------------------------
// Browser API feature detection
// ---------------------------------------------------------------------------

/** Run `fn` inside a View Transition if the API is available; otherwise run it directly. */
function withViewTransition(fn: () => void): void {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(document as any).startViewTransition(fn)
  } else {
    fn()
  }
}

/** Returns true if the Navigation API is available in this environment. */
function hasNavigationApi(): boolean {
  return typeof (globalThis as Record<string, unknown>)['navigation'] !== 'undefined'
}

// ---------------------------------------------------------------------------
// Route guard types
// ---------------------------------------------------------------------------

/**
 * A route guard called before navigation completes.
 * Return `true` to allow navigation, or a redirect URL string to redirect instead.
 */
export type RouteGuard = (to: string, from: string) => Promise<true | string> | (true | string)

// ---------------------------------------------------------------------------
// Router types
// ---------------------------------------------------------------------------

/** Internal route config stored on the router (includes guards and load fn). */
export interface RouterRouteConfig {
  path: string
  component: unknown
  beforeEnter?: RouteGuard
  load?: () => Promise<unknown>
}

export interface Router extends StewieRouterSPI {
  // Internal: update location store with optional explicit params
  _setLocation(url: string, params?: Record<string, string>): void
  // Internal: list of registered route configs (set by Router component)
  _routes: RouterRouteConfig[]
  // Internal: signal holding the most recent route load() result
  _routeData: Signal<unknown>
  // Internal: remove browser event listeners attached by createRouter()
  _dispose(): void
  // Internal: run guards + loader for the given URL, returns redirect URL or null
  _runGuardsAndLoad(url: string): Promise<string | null>
}

export const RouterContext = createContext<Router | null>(null)

export function createRouter(initialUrl?: string): Router {
  // _routeData is created inside createRoot() so signal creation is allowed.
  let _routeData!: Signal<unknown>
  createRoot(() => {
    _routeData = signal<unknown>(undefined)
  })

  const location: RouterStore = createLocationStore(initialUrl ?? '/')

  /** Compute params for a URL against the registered routes. */
  function resolveParams(pathname: string): Record<string, string> {
    let params: Record<string, string> = {}
    let bestScore = -1
    for (const route of router._routes) {
      const result = matchRoute(route.path, pathname)
      if (result && result.score > bestScore) {
        params = result.params
        bestScore = result.score
      }
    }
    return params
  }

  /** Apply a parsed URL to the reactive location store. */
  function applyLocation(url: string, params?: Record<string, string>): void {
    const parsed = parseUrl(url)
    location.pathname = parsed.pathname
    location.query = parsed.query
    location.hash = parsed.hash
    location.params = params ?? resolveParams(parsed.pathname)
  }

  /**
   * Find the best-matching route for a URL and run its guard + load fn.
   * Returns the redirect URL if a guard blocks, or null to proceed.
   */
  async function runGuardsAndLoad(url: string): Promise<string | null> {
    const parsed = parseUrl(url)
    let bestRoute: RouterRouteConfig | null = null
    let bestScore = -1
    for (const route of router._routes) {
      const result = matchRoute(route.path, parsed.pathname)
      if (result && result.score > bestScore) {
        bestRoute = route
        bestScore = result.score
      }
    }

    if (!bestRoute) return null

    // Run beforeEnter guard
    if (bestRoute.beforeEnter) {
      const result = await bestRoute.beforeEnter(url, location.pathname)
      if (result !== true) return result as string
    }

    // Run route-level data loader.
    // Always reset _routeData on route change: if the incoming route has no
    // loader the previous route's data should not bleed through.
    _routeData.set(undefined)
    if (bestRoute.load) {
      const data = await bestRoute.load()
      _routeData.set(data)
    }

    return null
  }

  // Holds the cleanup function for browser event listeners.
  let _listenersDisposer = () => {}

  /** Apply location update and push to browser history. */
  function applyLocationAndPush(url: string, replace: boolean): void {
    withViewTransition(() => {
      applyLocation(url)
    })
    if (typeof globalThis.history !== 'undefined') {
      if (replace) {
        globalThis.history.replaceState(null, '', url)
      } else {
        globalThis.history.pushState(null, '', url)
      }
    }
  }

  const router: Router = {
    location,
    _routes: [],
    _routeData,

    _dispose() {
      _listenersDisposer()
    },

    _runGuardsAndLoad(url: string): Promise<string | null> {
      return runGuardsAndLoad(url)
    },

    navigate(to: string | NavigateOptions): Promise<void> {
      const url = typeof to === 'string' ? to : to.to
      const replace = typeof to !== 'string' && !!to.replace

      // Synchronous fast path — no guards or loaders registered on any route.
      // Keeps simple navigations fully synchronous and avoids microtask overhead.
      const hasGuardsOrLoaders = router._routes.some((r) => r.beforeEnter || r.load)
      if (!hasGuardsOrLoaders) {
        if (hasNavigationApi()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(globalThis as any).navigation.navigate(url, { history: replace ? 'replace' : 'push' })
        } else {
          applyLocationAndPush(url, replace)
        }
        return Promise.resolve()
      }

      // Async path — run guards and loaders, then apply location.
      return (async () => {
        const redirect = await runGuardsAndLoad(url)
        if (redirect !== null) {
          return router.navigate(redirect)
        }

        if (hasNavigationApi()) {
          // Navigation API path: just issue the navigation. The 'navigate' event
          // listener below will intercept it and call applyLocation inside a View
          // Transition — so we must NOT call applyLocation or startViewTransition
          // here, otherwise the transition fires twice and the browser logs
          // "Transition was skipped".
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(globalThis as any).navigation.navigate(url, { history: replace ? 'replace' : 'push' })
        } else {
          applyLocationAndPush(url, replace)
        }
      })()
    },

    back() {
      if (hasNavigationApi()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).navigation.back()
      } else if (typeof globalThis.history !== 'undefined') {
        globalThis.history.back()
      }
    },

    forward() {
      if (hasNavigationApi()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).navigation.forward()
      } else if (typeof globalThis.history !== 'undefined') {
        globalThis.history.forward()
      }
    },

    match(pattern: string): RouteMatch | null {
      const result = matchRoute(pattern, location.pathname)
      if (!result) return null
      return { pattern, params: result.params, score: result.score }
    },

    _setLocation(url: string, params?: Record<string, string>) {
      applyLocation(url, params)
    },
  }

  // ---------------------------------------------------------------------------
  // Browser history listeners
  // ---------------------------------------------------------------------------

  if (typeof globalThis.addEventListener === 'function' && typeof globalThis.location !== 'undefined') {
    if (hasNavigationApi()) {
      // Navigation API: fires for ALL navigations including back/forward,
      // so we don't also need a popstate listener.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navHandler = (event: any) => {
        if (!event.canIntercept || event.hashChange || event.downloadRequest !== null) return
        const destUrl = new URL(event.destination.url)
        const destPath = destUrl.pathname + destUrl.search + destUrl.hash
        event.intercept({
          // The handler is async so the Navigation API shows a loading state while
          // guards / loaders run.
          //
          // event.userInitiated is true for browser-UI navigations (back/forward
          // button, address bar, link clicks that the browser handles natively).
          // It is false for programmatic navigation.navigate() calls — those come
          // from our own navigate() which already ran guards. Checking this flag
          // prevents running guards twice for programmatic navigations.
          handler: event.userInitiated
            ? async () => {
                const redirect = await runGuardsAndLoad(destPath)
                if (redirect !== null) {
                  // Guard redirected. Apply the redirect URL directly so the
                  // reactive location and browser history both show the target.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ;(globalThis as any).navigation.navigate(redirect, { history: 'replace' })
                  return
                }
                withViewTransition(() => {
                  applyLocation(destPath)
                })
              }
            : () => {
                // Programmatic path — guards already ran in navigate(); just apply.
                withViewTransition(() => {
                  applyLocation(destPath)
                })
              },
        })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).navigation.addEventListener('navigate', navHandler)
      _listenersDisposer = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).navigation.removeEventListener('navigate', navHandler)
      }
    } else {
      // History API fallback: popstate fires on back/forward button.
      // Run guards before applying the new location so that auth redirects
      // and data loaders work on browser back/forward navigation.
      const popHandler = () => {
        const url =
          globalThis.location.pathname +
          globalThis.location.search +
          globalThis.location.hash
        ;(async () => {
          const redirect = await runGuardsAndLoad(url)
          if (redirect !== null) {
            // Re-enter navigate() so the redirect target's own guards and
            // loaders run, rather than bypassing them with a bare location push.
            await router.navigate({ to: redirect, replace: true })
            return
          }
          withViewTransition(() => {
            applyLocation(url)
          })
        })()
      }
      globalThis.addEventListener('popstate', popHandler)
      _listenersDisposer = () => {
        globalThis.removeEventListener('popstate', popHandler)
      }
    }
  }

  return router
}

export function useRouter(): Router {
  const router = inject(RouterContext)
  if (!router) throw new Error('useRouter() called outside of <Router> provider')
  return router
}
