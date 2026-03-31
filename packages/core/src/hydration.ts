// hydration.ts — shared hydration registry types and context token.
// Used by both @stewie-js/server (serializes state) and client hydrate() (reads state).

import { createContext, inject } from './context.js';

export interface HydrationRegistry {
  set(key: string, value: unknown): void;
  get(key: string): unknown;
  serialize(): string;
}

// Shared context token — the same symbol is used on both server and client,
// allowing provide/inject to wire the registry through the component tree.
export const HydrationRegistryContext = createContext<HydrationRegistry | null>(null);

export function useHydrationRegistry(): HydrationRegistry | null {
  return inject(HydrationRegistryContext);
}
