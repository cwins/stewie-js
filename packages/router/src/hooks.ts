// hooks.ts — router hooks

import { useRouter } from './router.js';
import type { RouterStore } from './location.js';

export function useLocation(): RouterStore {
  return useRouter().location as RouterStore;
}

export function useParams<T extends Record<string, string>>(): T {
  return useRouter().location.params as T;
}

export function useQuery<T extends Record<string, string>>(): T {
  return useRouter().location.query as T;
}

/**
 * Returns the data loaded by the current route's `load()` function.
 * Reactive — re-reads when navigation loads new data.
 */
export function useRouteData<T = unknown>(): T {
  return useRouter()._routeData() as T;
}
