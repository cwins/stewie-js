// router.ts — router context + navigation

import { createContext, inject } from '@stewie/core'
import { createLocationStore, parseUrl } from './location.js'
import type { RouterStore } from './location.js'
import type { StewieRouterSPI, NavigateOptions, RouteMatch } from '@stewie/router-spi'
import { matchRoute } from './matcher.js'

export interface Router extends StewieRouterSPI {
  // Internal: update location store
  _setLocation(url: string, params?: Record<string, string>): void
}

export const RouterContext = createContext<Router | null>(null)

export function createRouter(initialUrl?: string): Router {
  const location: RouterStore = createLocationStore(initialUrl ?? '/')

  const router: Router = {
    location,

    navigate(to: string | NavigateOptions) {
      const url = typeof to === 'string' ? to : to.to
      const parsed = parseUrl(url)
      // Update each property individually (store proxy intercepts property access)
      location.pathname = parsed.pathname
      location.query = parsed.query
      location.hash = parsed.hash
      location.params = {} // Clear stale params; callers use _setLocation to set new params
      // In browser: update history API
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
      if (params) location.params = params
    },
  }

  return router
}

export function useRouter(): Router {
  const router = inject(RouterContext)
  if (!router) throw new Error('useRouter() called outside of <Router> provider')
  return router
}
