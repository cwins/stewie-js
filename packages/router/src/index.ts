// @stewie-js/router — reactive URL-as-store routing
export const version = '0.8.0';
export { createRouter, useRouter, RouterContext, RedirectError, OutletContext } from './router.js';
export { Router, Route, Link, Outlet, createSsrRouter } from './components.js';
export { useLocation, useParams, useQuery, useRouteData, useNavigationStatus } from './hooks.js';
export { matchRoute, sortRoutes } from './matcher.js';
export { createLocationStore, parseUrl, parseQuery } from './location.js';
export type { Router as RouterType, RouteGuard, FlatRouteChain, RouteChainLevel, OutletContextValue } from './router.js';
export type { RouterProps, RouteProps, LinkProps, OutletProps } from './components.js';
export type { RouterStore } from './location.js';
export type { MatchResult } from './matcher.js';
