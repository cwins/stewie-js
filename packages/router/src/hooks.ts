// hooks.ts — router utility functions

import { consume } from '@stewie-js/core';
import { useRouter } from './router.js';
import { OutletContext } from './router.js';
import type { OutletContextValue } from './router.js';
import { matchRoute } from './matcher.js';
import type { RouterStore } from './location.js';
import type { NavigationStatus } from '@stewie-js/router-spi';

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
 *
 * In a nested route tree, each layout and leaf gets its own data from its
 * own loader. `useRouteData()` returns data for the component's nesting
 * depth as determined by the nearest `OutletContext`.
 *
 * In a flat route tree (no layouts), it returns the leaf route's data as
 * before.
 *
 * Reactive — re-reads when navigation loads new data.
 */
export function useRouteData<T = unknown>(): T {
  const router = useRouter();

  // Read the current nesting depth from OutletContext to look up the right level.
  let ctx: OutletContextValue | null = null;
  try {
    ctx = consume(OutletContext);
  } catch {
    // No OutletContext — fall back to best-matched leaf
  }

  if (ctx) {
    const level = ctx.chain.levels[ctx.depth];
    if (level) {
      const sig = router._routeDataMap.get(level.fullPath);
      if (sig) return sig() as T;
    }
    return undefined as T;
  }

  // Fallback: no OutletContext (flat routes or called outside router context).
  // Return the leaf's data from the best-matched chain.
  const pathname = router.location.pathname;
  let bestSig: ReturnType<typeof router._routeDataMap.get> | undefined;
  let bestScore = -1;
  for (const chain of router._chains) {
    const result = matchRoute(chain.leafPath, pathname);
    if (result && result.score > bestScore) {
      bestScore = result.score;
      const leaf = chain.levels[chain.levels.length - 1];
      bestSig = router._routeDataMap.get(leaf.fullPath);
    }
  }
  return (bestSig ? bestSig() : undefined) as T;
}

/**
 * Returns the reactive navigation status object.
 * Subscribe to `status.phase` to show a progress indicator during navigation.
 */
export function useNavigationStatus(): NavigationStatus {
  return useRouter().status;
}
