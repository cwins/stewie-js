// data-registry.ts — keyed cache + SSR replay primitive.
//
// One registry primitive backs both:
//   - SSR state replay: server writes resolved resource/loader data, the
//     stream emits inline `hydrateByKey(key, json)` calls near each
//     consuming Suspense boundary, the client registry seeds from those
//     payloads before the consumer's first read.
//   - Client-side cache: useResource consults the registry before fetching;
//     a fresh hit short-circuits the fetcher entirely.
//
// The interface is the SPI we feel comfortable making public eventually.
// The implementation here is store-backed so consumers get reactive
// cache invalidation and devtools inspection through the existing store
// machinery — no separate observation layer.

import { store } from './store.js';
import { createContext, consume } from './context.js';

export interface DataRegistry {
  has(key: string): boolean;
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  /**
   * Iterate the keys currently in the registry. Used by streaming SSR to
   * diff which keys were written during a Suspense boundary so it can emit
   * an inline payload for just the new entries.
   */
  keys(): string[];
  /**
   * Serialize the entire registry to a JSON string. Used for end-of-stream
   * `__STEWIE_STATE__` payloads when inline-near-consumer emission isn't
   * possible (e.g. a renderToString call without Suspense flushes).
   */
  serialize(): string;
  /**
   * Serialize a single entry. Used by streaming SSR to emit
   * `hydrateByKey(key, json)` calls inline alongside each Suspense
   * boundary's HTML flush — preserves progressive hydration because
   * each boundary's data lands with its content.
   */
  serializeByKey(key: string): string;
  hydrate(serialized: string): void;
  hydrateByKey(key: string, serialized: string): void;
}

export function createDataRegistry(): DataRegistry {
  const state = store<{ entries: Record<string, unknown> }>({ entries: {} });
  return {
    has(key) {
      return Object.prototype.hasOwnProperty.call(state.entries, key);
    },
    get(key) {
      return state.entries[key];
    },
    set(key, value) {
      state.entries[key] = value;
    },
    keys() {
      return Object.keys(state.entries);
    },
    serialize() {
      return JSON.stringify(state.entries);
    },
    serializeByKey(key) {
      return JSON.stringify(state.entries[key]);
    },
    hydrate(serialized) {
      const parsed = JSON.parse(serialized) as Record<string, unknown>;
      for (const k of Object.keys(parsed)) {
        state.entries[k] = parsed[k];
      }
    },
    hydrateByKey(key, serialized) {
      state.entries[key] = JSON.parse(serialized);
    }
  };
}

// Shared context token — server provides the per-request registry; client
// hydrate() provides the per-mount registry. Components consume to seed
// resource data and write fetch results back.
export const DataRegistryContext = createContext<DataRegistry | null>(null);

export function useDataRegistry(): DataRegistry | null {
  return consume(DataRegistryContext);
}

/**
 * Stable key derivation: `${defId}:${stableSerialize(args)}`. Object property
 * order is normalized so two calls with `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }`
 * land on the same registry entry. Loaders and resources currently namespace
 * differently (`route:${path}:${paramsHash}` vs `${defId}:${argsHash}`); both
 * compose this helper for the args portion.
 */
export function dataRegistryKey(defId: string, args: unknown): string {
  return `${defId}:${stableSerialize(args)}`;
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`);
  return `{${parts.join(',')}}`;
}
