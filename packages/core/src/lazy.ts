// lazy.ts — lazily-loaded component factory

import { signal } from './reactive.js';
import { jsx } from './jsx-runtime.js';
import type { JSXElement, Component } from './jsx-runtime.js';

/**
 * Sentinel type for the LazyBoundary descriptor.
 * The DOM renderer and SSR renderer use this symbol to detect lazy placeholders
 * and emit a named <!--Lazy--> anchor (distinct from the <!---->  function-child
 * anchors) so the hydration cursor can tell them apart.
 */
export const _LazyBoundary: unique symbol = Symbol('LazyBoundary');

/** Internal props shape stored on a _LazyBoundary descriptor. */
export interface _LazyBoundaryProps {
  /** Reactive accessor — returns true once the module has loaded. */
  loaded: () => boolean;
  /** Renders the loaded component with the captured props. */
  render: () => JSXElement | null;
  /**
   * Manifest key for this lazy boundary's chunk — root-relative source path
   * (e.g. `src/pages/foo.tsx`). Populated by the Vite plugin's lazy() transform
   * when present; absent when lazy() is called directly without the compiler.
   * SSR uses it to look up CSS/JS assets in Vite's `ssr-manifest.json` and
   * emit progressive `<link>` hints inline with the boundary flush.
   */
  id?: string;
}

// ---------------------------------------------------------------------------
// CSS-load gating
// ---------------------------------------------------------------------------

/**
 * Per-id cache of stylesheet-ready promises. Once all stylesheets for a given
 * lazy boundary id have loaded (or errored), subsequent mounts of the same
 * boundary reuse the already-resolved Promise and skip redundant DOM work.
 *
 * Keyed by the manifest id (e.g. `src/pages/AdminPage.tsx`). Entries are
 * never evicted — the lifetime is the app instance, which is correct: once
 * styles for a boundary have been loaded they stay loaded.
 */
const stylesReadyCache = new Map<string, Promise<void>>();

/**
 * Wait for all CSS assets associated with a lazy boundary id to be loaded
 * before resolving.
 *
 * Cases:
 * - No manifest, no id, or id not in manifest → resolves immediately (dev
 *   path, compiler-off path, plain lazy() without the Vite plugin).
 * - Manifest present, link already in DOM with link.sheet !== null → resolves
 *   immediately (SSR emitted the <link> and it loaded before JS ran).
 * - Manifest present, link in DOM but still loading → attaches a load listener.
 * - Manifest present, link absent from DOM → injects a fresh <link> into
 *   <head> and waits for it to load (client-nav to a non-SSR'd route).
 * - Error event on a stylesheet → resolves anyway (better unstyled than stalled).
 *
 * Only CSS URLs are awaited; JS modulepreload hints are ignored here (JS
 * gating is implicit in factory() resolving).
 */
function awaitStyles(id: string | undefined): Promise<void> {
  // No-op path: no id, or no manifest on window.
  if (!id) return Promise.resolve();

  const manifest =
    typeof window !== 'undefined' ? (window as Window).__STEWIE_MANIFEST__ : undefined;
  if (!manifest) return Promise.resolve();

  const urls = manifest[id];
  if (!urls || urls.length === 0) return Promise.resolve();

  // Filter to CSS only — JS chunks are already handled by factory() resolution.
  const cssUrls = urls.filter((u) => u.endsWith('.css'));
  if (cssUrls.length === 0) return Promise.resolve();

  // Serve from cache if this boundary's styles have been awaited before.
  const cached = stylesReadyCache.get(id);
  if (cached) return cached;

  const promise = Promise.all(cssUrls.map(awaitOneStylesheet)).then(() => undefined);
  stylesReadyCache.set(id, promise);
  return promise;
}

/**
 * Wait for a single stylesheet URL to be ready in the browser.
 *
 * Checks whether a matching <link> already exists in the document and, if so,
 * whether it has already loaded. If the link is absent it is injected. In all
 * cases the returned promise resolves on load or error — never permanently
 * stalls.
 *
 * The "already loaded" heuristic is `link.sheet !== null`. This is synchronous
 * and works for same-origin sheets in all browsers. Cross-origin sheets that
 * block CORS will have `link.sheet === null` even after loading (the browser
 * gives no access to the sheet object). In that case the runtime falls through
 * to attaching a load listener, which will fire correctly — only the
 * synchronous fast-path is unavailable for cross-origin sheets.
 */
function awaitOneStylesheet(href: string): Promise<void> {
  return new Promise<void>((resolve) => {
    // Look for an existing <link> with this href.
    let link = document.querySelector<HTMLLinkElement>(
      `link[rel="stylesheet"][href="${CSS.escape(href)}"]`
    );

    if (link) {
      // Fast path: sheet is already populated → already loaded.
      // Accessing link.sheet can throw for cross-origin stylesheets when the
      // browser enforces CORS. We treat that as "not yet readable", i.e. fall
      // through to the listener path.
      try {
        if (link.sheet !== null) {
          resolve();
          return;
        }
      } catch {
        // cross-origin CORS block — fall through to listener
      }
    } else {
      // Client-nav case: inject a fresh <link>.
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }

    // Attach load/error listeners. Both resolve — error means render unstyled
    // rather than stall the boundary permanently.
    const onLoad = () => {
      link!.removeEventListener('load', onLoad);
      link!.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      link!.removeEventListener('load', onLoad);
      link!.removeEventListener('error', onError);
      resolve();
    };
    link.addEventListener('load', onLoad);
    link.addEventListener('error', onError);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
export function lazy<T extends Component>(factory: () => Promise<T | { default: T }>, id?: string): T {
  // Shared across all instances of this lazy component (one per lazy() call).
  let loadedComponent: T | null = null;
  let loadPromise: Promise<void> | null = null;

  function startLoad(): Promise<void> {
    if (!loadPromise) {
      const factoryDone = factory().then((mod) => {
        loadedComponent =
          mod !== null && typeof mod === 'object' && 'default' in mod
            ? (mod as { default: T }).default
            : (mod as T);
      });
      loadPromise = Promise.all([factoryDone, awaitStyles(id)]) as unknown as Promise<void>;
    }
    return loadPromise;
  }

  function LazyComponent(props: Record<string, unknown>) {
    // Per-instance signal — starts true if already loaded (e.g. second
    // navigation to the same route). Signal creation is allowed here because
    // the dom-renderer calls component functions inside reactiveScope().
    const loaded = signal(loadedComponent !== null);

    if (!loadedComponent) {
      startLoad().then(() => {
        // Safe to call even if the component has been unmounted — the effect
        // was disposed so there are no subscribers, making this a no-op.
        loaded.set(true);
      });
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
      id
    };

    return {
      type: _LazyBoundary as unknown,
      props: lazyProps as unknown as Record<string, unknown>,
      key: null
    } as JSXElement;
  }

  return LazyComponent as unknown as T;
}
