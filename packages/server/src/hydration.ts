// Re-export shared types and context from @stewie-js/core so the public API
// of @stewie-js/server is unchanged.
export type { HydrationRegistry } from '@stewie-js/core';
export { HydrationRegistryContext, useHydrationRegistry } from '@stewie-js/core';

// Server-side registry — collects state during SSR for serialization.
import type { HydrationRegistry } from '@stewie-js/core';

export function createHydrationRegistry(): HydrationRegistry {
  const store = new Map<string, unknown>();
  return {
    set(key, value) {
      store.set(key, value);
    },
    get(key) {
      return store.get(key);
    },
    serialize() {
      return JSON.stringify(Object.fromEntries(store));
    }
  };
}
