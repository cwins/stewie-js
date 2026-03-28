// components.ts — route components

import { jsx, inject } from '@stewie-js/core'
import type { JSXElement, Component } from '@stewie-js/core'
import { createRouter, RouterContext } from './router.js'
import type { Router, RouteGuard } from './router.js'
import { matchRoute } from './matcher.js'

export interface RouterProps {
  /** Starting URL — defaults to window.location on browser, '/' on server. */
  initialUrl?: string
  /** <Route> elements that define the route table. */
  children: JSXElement | JSXElement[]
}

export interface RouteProps {
  path: string
  component: Component
  /**
   * Guard called before this route is activated. Return `true` to allow
   * navigation, or a redirect URL string to redirect instead.
   */
  beforeEnter?: RouteGuard
  /**
   * Async data loader. Called before the route component renders; result is
   * available via `useRouteData()` in the component tree.
   */
  load?: () => Promise<unknown>
}

export interface LinkProps {
  to: string
  replace?: boolean
  children: JSXElement | JSXElement[] | string
  class?: string
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RouteConfig {
  path: string
  component: Component
  beforeEnter?: RouteGuard
  load?: () => Promise<unknown>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract RouteConfig objects from the children of a Router. */
function extractRoutes(children: JSXElement | JSXElement[] | undefined): RouteConfig[] {
  if (!children) return []
  const arr = Array.isArray(children) ? children : [children]
  return arr
    .filter((c): c is JSXElement => c !== null && c !== undefined && typeof c === 'object' && 'type' in c)
    .filter((c) => c.type === (Route as unknown))
    .map((c) => ({
      path: c.props.path as string,
      component: c.props.component as Component,
      beforeEnter: c.props.beforeEnter as RouteGuard | undefined,
      load: c.props.load as (() => Promise<unknown>) | undefined,
    }))
}

/** Find the best-matching route for a given pathname. */
function findBestMatch(
  routes: RouteConfig[],
  pathname: string,
): { component: Component; params: Record<string, string> } | null {
  let best: { component: Component; params: Record<string, string>; score: number } | null = null
  for (const route of routes) {
    const result = matchRoute(route.path, pathname)
    if (result && (!best || result.score > best.score)) {
      best = { component: route.component, params: result.params, score: result.score }
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Router component
// ---------------------------------------------------------------------------

/**
 * Provides routing for its children.
 *
 * - Accepts <Route path="…" component={…} /> children to define the route table.
 * - Renders the matched route component for the current URL.
 * - Provides the router instance via RouterContext so child components can call
 *   useRouter(), useParams(), etc.
 * - In the browser, reacts to navigation changes (pushState / popstate).
 *
 * Usage:
 * ```tsx
 * <Router>
 *   <Route path="/" component={Home} />
 *   <Route path="/about" component={About} />
 *   <Route path="/users/:id" component={UserDetail} />
 * </Router>
 * ```
 */
export function Router(props: RouterProps): JSXElement {
  const initialUrl =
    props.initialUrl ??
    (typeof globalThis.location !== 'undefined'
      ? globalThis.location.pathname + globalThis.location.search + globalThis.location.hash
      : '/')

  const router = createRouter(initialUrl)
  const routes = extractRoutes(props.children)

  // Register routes so navigate() can resolve params
  router._routes = routes

  // matchedContent is a reactive function — the DOM renderer wraps it in effect()
  // and re-renders whenever router.location.pathname changes.
  // The SSR renderer calls it once synchronously.
  const matchedContent = (): JSXElement | null => {
    const match = findBestMatch(routes, router.location.pathname)
    if (!match) return null
    // Keep params in sync with the current match
    if (JSON.stringify(router.location.params) !== JSON.stringify(match.params)) {
      router.location.params = match.params
    }
    return jsx(match.component, { params: router.location.params })
  }

  return jsx(RouterContext.Provider as unknown as Component, {
    value: router,
    children: matchedContent,
  })
}

// ---------------------------------------------------------------------------
// Route component — config-only descriptor, consumed by Router
// ---------------------------------------------------------------------------

/**
 * Declares a route mapping inside a <Router>.
 * This component is never rendered directly; Router scans its children for
 * Route descriptors to build the route table.
 */
export function Route(_props: RouteProps): JSXElement {
  // Route is only a configuration marker. Its JSXElement descriptor is read by
  // Router.extractRoutes() and never rendered directly.
  return jsx('template', {})
}

// ---------------------------------------------------------------------------
// Link component
// ---------------------------------------------------------------------------

/**
 * Client-side navigation anchor.
 * Prevents full-page reloads; uses router.navigate() when a RouterContext
 * is available. Falls back to a normal <a href> otherwise (SSR, no-router).
 *
 * Modifier keys (Ctrl/Cmd/Alt/Shift) allow the browser to handle the click
 * normally (open in new tab, etc.).
 */
export function Link(props: LinkProps): JSXElement {
  // Capture router synchronously during component render (inject works here).
  let router: Router | null = null
  try {
    router = inject(RouterContext)
  } catch {
    // No RouterContext — fall through, renders as plain anchor
  }

  const handleClick = router
    ? (e: Event) => {
        if (
          e instanceof MouseEvent &&
          (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.button !== 0)
        ) {
          return // Let browser handle modifier+click
        }
        e.preventDefault()
        router!.navigate({ to: props.to, replace: props.replace })
      }
    : undefined

  return jsx('a', {
    href: props.to,
    class: props.class,
    children: props.children,
    ...(handleClick ? { onClick: handleClick } : {}),
  })
}
