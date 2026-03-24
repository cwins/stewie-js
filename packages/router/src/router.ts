// router.ts — router context + navigation

import { createContext, inject } from '@stewie/core'
import { createLocationStore, parseUrl } from './location.js'
import type { RouterStore } from './location.js'
import type { StewieRouterSPI, NavigateOptions, RouteMatch } from '@stewie/router-spi'
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

  const router: Router = {
    location,
    _routes: [],

    navigate(to: string | NavigateOptions) {
      const url = typeof to === 'string' ? to : to.to
      const replace = typeof to !== 'string' && !!to.replace

      // Wrap reactive store updates in a View Transition so the browser can
      // animate between the old and new DOM states using CSS view-transition-*
      // pseudo-elements. Falls back to a direct update if the API is absent.
      withViewTransition(() => {
        applyLocation(url)
      })

      // Push/replace the browser URL.
      // Prefer the Navigation API (navigate event, better back/forward handling)
      // and fall back to History API when it's unavailable.
      if (hasNavigationApi()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).navigation.navigate(url, { history: replace ? 'replace' : 'push' })
      } else if (typeof globalThis.history !== 'undefined') {
        if (replace) {
          globalThis.history.replaceState(null, '', url)
        } else {
          globalThis.history.pushState(null, '', url)
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
      ;(globalThis as any).navigation.addEventListener('navigate', (event: any) => {
        if (!event.canIntercept || event.hashChange || event.downloadRequest !== null) return
        event.intercept({
          handler: () => {
            withViewTransition(() => {
              applyLocation(new URL(event.destination.url).pathname + new URL(event.destination.url).search + new URL(event.destination.url).hash)
            })
          },
        })
      })
    } else {
      // History API fallback: popstate fires on back/forward button
      globalThis.addEventListener('popstate', () => {
        const url =
          globalThis.location.pathname +
          globalThis.location.search +
          globalThis.location.hash
        withViewTransition(() => {
          applyLocation(url)
        })
      })
    }
  }

  return router
}

export function useRouter(): Router {
  const router = inject(RouterContext)
  if (!router) throw new Error('useRouter() called outside of <Router> provider')
  return router
}
