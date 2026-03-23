// router.ts — router context + navigation

import { createContext, inject } from '@stewie/core'
import { createLocationStore, parseUrl } from './location.js'
import type { RouterStore } from './location.js'
import type { StewieRouterSPI, NavigateOptions, RouteMatch } from '@stewie/router-spi'
import { matchRoute } from './matcher.js'

export interface Router extends StewieRouterSPI {
  // Internal: update location store with optional explicit params
  _setLocation(url: string, params?: Record<string, string>): void
  // Internal: list of registered route patterns (set by Router component)
  _routes: Array<{ path: string; component: unknown }>
}

export const RouterContext = createContext<Router | null>(null)

export function createRouter(initialUrl?: string): Router {
  const location: RouterStore = createLocationStore(initialUrl ?? '/')

  const router: Router = {
    location,
    _routes: [],

    navigate(to: string | NavigateOptions) {
      const url = typeof to === 'string' ? to : to.to
      const parsed = parseUrl(url)

      // Try to match a registered route to get params
      let params: Record<string, string> = {}
      let bestScore = -1
      for (const route of router._routes) {
        const result = matchRoute(route.path, parsed.pathname)
        if (result && result.score > bestScore) {
          params = result.params
          bestScore = result.score
        }
      }

      location.pathname = parsed.pathname
      location.query = parsed.query
      location.hash = parsed.hash
      location.params = params

      if (typeof globalThis.history !== 'undefined') {
        const replace = typeof to !== 'string' && to.replace
        if (replace) {
          globalThis.history.replaceState(null, '', url)
        } else {
          globalThis.history.pushState(null, '', url)
        }
      }
    },

    back() {
      if (typeof globalThis.history !== 'undefined') {
        globalThis.history.back()
      }
    },

    forward() {
      if (typeof globalThis.history !== 'undefined') {
        globalThis.history.forward()
      }
    },

    match(pattern: string): RouteMatch | null {
      const result = matchRoute(pattern, location.pathname)
      if (!result) return null
      return { pattern, params: result.params, score: result.score }
    },

    _setLocation(url: string, params?: Record<string, string>) {
      const parsed = parseUrl(url)
      location.pathname = parsed.pathname
      location.query = parsed.query
      location.hash = parsed.hash
      if (params !== undefined) location.params = params
    },
  }

  // In browser: listen for popstate (back/forward button navigation)
  if (typeof globalThis.addEventListener === 'function' && typeof globalThis.location !== 'undefined') {
    const handlePopstate = () => {
      const url =
        globalThis.location.pathname +
        globalThis.location.search +
        globalThis.location.hash
      router._setLocation(url)
    }
    globalThis.addEventListener('popstate', handlePopstate)
  }

  return router
}

export function useRouter(): Router {
  const router = inject(RouterContext)
  if (!router) throw new Error('useRouter() called outside of <Router> provider')
  return router
}
