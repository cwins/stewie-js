import { createContext, inject } from '@stewie/core'

export interface HydrationRegistry {
  // Store serializable state keyed by a string ID
  set(key: string, value: unknown): void
  get(key: string): unknown
  serialize(): string // Returns JSON string of all state
}

export function createHydrationRegistry(): HydrationRegistry {
  const store = new Map<string, unknown>()
  return {
    set(key, value) {
      store.set(key, value)
    },
    get(key) {
      return store.get(key)
    },
    serialize() {
      return JSON.stringify(Object.fromEntries(store))
    },
  }
}

// Context token for the hydration registry
export const HydrationRegistryContext = createContext<HydrationRegistry | null>(null)

// Hook to access the hydration registry in components
export function useHydrationRegistry(): HydrationRegistry | null {
  return inject(HydrationRegistryContext)
}
