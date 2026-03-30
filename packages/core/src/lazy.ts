// lazy.ts — lazily-loaded component factory

import { signal } from './reactive.js'
import { jsx } from './jsx-runtime.js'
import type { JSXElement, Component } from './jsx-runtime.js'

/**
 * Sentinel type for the LazyBoundary descriptor.
 * The DOM renderer and SSR renderer use this symbol to detect lazy placeholders
 * and emit a named <!--Lazy--> anchor (distinct from the <!---->  function-child
 * anchors) so the hydration cursor can tell them apart.
 */
export const _LazyBoundary: unique symbol = Symbol('LazyBoundary')

/** Internal props shape stored on a _LazyBoundary descriptor. */
export interface _LazyBoundaryProps {
  /** Reactive accessor — returns true once the module has loaded. */
  loaded: () => boolean
  /** Renders the loaded component with the captured props. */
  render: () => JSXElement | null
}

/**
 * Creates a lazily-loaded component. The `factory` is a function that returns
 * a dynamic import — the bundler code-splits at this boundary.
 *
 * While the module is loading the component renders nothing (empty <!--Lazy-->
 * placeholder). Once loaded it renders the real component reactively.
 *
 * The component descriptor uses a _LazyBoundary sentinel so the DOM renderer
 * can emit a named <!--Lazy--> anchor instead of the generic <!---->  used for
 * function children — preventing hydration-cursor ambiguity when a lazy
 * component is nested inside a reactive parent (e.g. Router matchedContent).
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

    // Return a _LazyBoundary descriptor instead of a function thunk.
    //
    // Previously this returned `() => loaded() ? jsx(comp, props) : null` — a
    // function child — which caused the DOM renderer to emit a generic <!---->
    // anchor that the hydration cursor could not distinguish from the outer
    // function-child anchor (e.g. Router matchedContent). The result was a
    // spurious extra <!---> node on the client, breaking hydration.
    //
    // By returning a _LazyBoundary descriptor the renderer emits <!--Lazy-->
    // instead, which is uniquely named and correctly scoped.
    const lazyProps: _LazyBoundaryProps = {
      loaded: () => loaded(),
      render: () => (loadedComponent ? jsx(loadedComponent as unknown as Component, props) : null),
    }

    return {
      type: _LazyBoundary as unknown,
      props: lazyProps as unknown as Record<string, unknown>,
      key: null,
    } as JSXElement
  }

  return LazyComponent as unknown as T
}
