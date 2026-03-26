// router.ts — router context + navigation

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
// Router types
// ---------------------------------------------------------------------------

export interface Router extends StewieRouterSPI {
  // Internal: update location store with optional explicit params
  _setLocation(url: string, params?: Record<string, string>): void
  // Internal: list of registered route patterns (set by Router component)
  _routes: Array<{ path: string; component: unknown }>
  // Internal: remove browser event listeners attached by createRouter()
  _dispose(): void
}

export const RouterContext = createContext<Router | null>(null)

export function createRouter(initialUrl?: string): Router {
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

  // Holds the cleanup function for browser event listeners.
  // Populated after the router object is created so the handlers can close over it.
  let _listenersDisposer = () => {}

  const router: Router = {
    location,
    _routes: [],

    _dispose() {
      _listenersDisposer()
    },

    navigate(to: string | NavigateOptions) {
      const url = typeof to === 'string' ? to : to.to
      const replace = typeof to !== 'string' && !!to.replace

      if (hasNavigationApi()) {
        // Navigation API path: just issue the navigation. The 'navigate' event
        // listener below will intercept it and call applyLocation inside a View
        // Transition — so we must NOT call applyLocation or startViewTransition
        // here, otherwise the transition fires twice and the browser logs
        // "Transition was skipped".
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).navigation.navigate(url, { history: replace ? 'replace' : 'push' })
      } else {
        // History API fallback: update reactive store and push the URL manually.
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
        event.intercept({
          handler: () => {
            withViewTransition(() => {
              applyLocation(new URL(event.destination.url).pathname + new URL(event.destination.url).search + new URL(event.destination.url).hash)
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
      // History API fallback: popstate fires on back/forward button
      const popHandler = () => {
        const url =
          globalThis.location.pathname +
          globalThis.location.search +
          globalThis.location.hash
        withViewTransition(() => {
          applyLocation(url)
        })
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
