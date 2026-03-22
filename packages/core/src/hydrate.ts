// hydrate.ts — client-side hydration entrypoint.
// Reads __STEWIE_STATE__ serialized by the server, provides it via context,
// then mounts the app so components can access their initial server state.

import { provide } from './context.js'
import { mount } from './dom-renderer.js'
import { HydrationRegistryContext } from './hydration.js'
import type { HydrationRegistry } from './hydration.js'
import type { JSXElement } from './jsx-runtime.js'
import type { Disposer } from './dom-renderer.js'

declare global {
  interface Window {
    __STEWIE_STATE__?: Record<string, unknown>
  }
}

function createClientRegistry(state: Record<string, unknown>): HydrationRegistry {
  const data = { ...state }
  return {
    get: (key) => data[key],
    set: (key, value) => {
      data[key] = value
    },
    serialize: () => JSON.stringify(data),
  }
}

/**
 * Hydrate a server-rendered page.
 *
 * Reads `window.__STEWIE_STATE__` injected by renderToString(), provides it
 * via HydrationRegistryContext so components can access their initial state,
 * then mounts the app into the container.
 *
 * Returns a dispose function that unmounts the app.
 */
export function hydrate(
  root: JSXElement | Node | (() => JSXElement | Node | null) | null,
  container: Element,
): Disposer {
  const initialState = typeof window !== 'undefined' ? (window.__STEWIE_STATE__ ?? {}) : {}

  const registry = createClientRegistry(initialState as Record<string, unknown>)

  let disposer!: Disposer
  provide(HydrationRegistryContext, registry, () => {
    disposer = mount(root, container)
  })
  return disposer
}
