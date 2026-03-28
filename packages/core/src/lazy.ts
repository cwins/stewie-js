// lazy.ts — lazily-loaded component factory

import { signal } from './reactive.js'
import { jsx } from './jsx-runtime.js'
import type { Component } from './jsx-runtime.js'

/**
 * Creates a lazily-loaded component. The `factory` is a function that returns
 * a dynamic import — the bundler code-splits at this boundary.
 *
 * While the module is loading the component renders nothing. Once loaded it
 * renders the real component. Because the returned thunk reads a signal, the
 * DOM renderer replaces the placeholder automatically when loading completes.
 *
 * Usage:
 * ```ts
 * const MyPage = lazy(() => import('./MyPage'))
 *
 * // Inside a Router:
 * <Route path="/page" component={MyPage} />
 * ```
 */
export function lazy<T extends Component>(
  factory: () => Promise<T | { default: T }>,
): T {
  // Shared across all instances of this lazy component (one per lazy() call).
  let loadedComponent: T | null = null
  let loadPromise: Promise<void> | null = null

  function startLoad(): Promise<void> {
    if (!loadPromise) {
      loadPromise = factory().then((mod) => {
        loadedComponent =
          mod !== null && typeof mod === 'object' && 'default' in mod
            ? (mod as { default: T }).default
            : (mod as T)
      })
    }
    return loadPromise
  }

  // The returned function IS a Component — it creates a reactive thunk so the
  // dom-renderer re-evaluates when the import resolves.
  function LazyComponent(props: Record<string, unknown>) {
    // Per-instance signal — starts true if already loaded (e.g. second
    // navigation to the same route). Signal creation is allowed here because
    // the dom-renderer calls component functions inside createRoot().
    const loaded = signal(loadedComponent !== null)

    if (!loadedComponent) {
      startLoad().then(() => {
        // Safe to call even if the component has been unmounted — the effect
        // was disposed so there are no subscribers, making this a no-op.
        loaded.set(true)
      })
    }

    // Return a reactive thunk. renderChildren() in the DOM renderer treats
    // functions as reactive effects and re-renders when their reads change.
    return (): ReturnType<Component> => {
      if (!loaded() || !loadedComponent) return null
      return jsx(loadedComponent as unknown as Component, props)
    }
  }

  return LazyComponent as unknown as T
}
