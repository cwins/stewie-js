// resource.ts — async resource primitive

import { signal } from './reactive.js';
import type { Signal } from './reactive.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Resource<T> {
  /**
   * The resolved data. Undefined while loading or on error.
   * Reactive signal — subscribe to it in JSX or effects.
   */
  data: Signal<T | undefined>;
  /**
   * True while the fetch is in flight.
   * Reactive signal — use in `<Show when={() => !res.loading()}>` for DOM rendering.
   */
  loading: Signal<boolean>;
  /**
   * The error thrown by the fetcher, or null if no error.
   * Reactive signal.
   */
  error: Signal<unknown>;
  /**
   * Suspense-compatible accessor.
   * - Throws a Promise (caught by `<Suspense>`) while the fetch is in flight.
   * - Throws the error value if the fetch failed.
   * - Returns the resolved data when available.
   *
   * Primarily used for SSR where the server-side `<Suspense>` boundary awaits
   * the thrown Promise and retries rendering. For DOM rendering, the signal-based
   * API (`data`, `loading`, `error`) with `<Show>` is the recommended pattern.
   */
  read(): T;
  /**
   * Re-invoke the fetcher. Returns a Promise that resolves when the new fetch
   * completes (successfully or with an error).
   */
  refetch(): Promise<void>;
}

// ---------------------------------------------------------------------------
// resource()
// ---------------------------------------------------------------------------

/**
 * Wraps an async function and returns reactive signals for its loading state,
 * resolved data, and error.
 *
 * The fetcher is called immediately when `resource()` is created.
 *
 * **DOM usage (recommended):**
 * ```tsx
 * function UserProfile() {
 *   const user = resource(() => fetch('/api/me').then(r => r.json()))
 *   return (
 *     <Show when={() => !user.loading()} fallback={<Spinner />}>
 *       <div>{user.data()?.name}</div>
 *     </Show>
 *   )
 * }
 * ```
 *
 * **SSR usage with `<Suspense>` and `read()`:**
 * ```tsx
 * function UserProfile() {
 *   const user = resource(() => fetch('/api/me').then(r => r.json()))
 *   const data = user.read()  // throws Promise on server; <Suspense> awaits it
 *   return <div>{data.name}</div>
 * }
 * // Wrap with: <Suspense fallback={<Spinner />}><UserProfile /></Suspense>
 * ```
 *
 * Note: For SSR data loading, prefer route-level `load()` functions which run
 * before any rendering begins. `resource()` is most useful for client-side
 * data fetching after the initial page load.
 */
export function resource<T>(fetcher: () => Promise<T>): Resource<T> {
  // Signals are created in the enclosing reactive scope (e.g. a component's
  // createRoot) — no need for a wrapper createRoot here.
  const _loading = signal<boolean>(true);
  const _data = signal<T | undefined>(undefined);
  const _error = signal<unknown>(null);

  // _currentPromise is what read() throws for Suspense integration.
  // It resolves on fetch success (so Suspense retries and gets data).
  // It rejects on fetch failure (so Suspense's rejection handler leaves fallback visible).
  let _currentPromise: Promise<void> = Promise.resolve();

  function _fetch(): Promise<void> {
    _loading.set(true);
    _error.set(null);

    let resolve!: () => void;
    let reject!: (err: unknown) => void;
    _currentPromise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Suppress "unhandled rejection" if nobody attaches Suspense to this resource.
    // Suspense boundaries that DO catch the Promise via thrown.then() will still
    // receive the rejection — attaching .catch() here doesn't prevent other handlers.
    _currentPromise.catch(() => {});

    fetcher().then(
      (data) => {
        _data.set(data);
        _loading.set(false);
        resolve();
      },
      (err) => {
        _error.set(err);
        _loading.set(false);
        reject(err);
      }
    );

    return _currentPromise;
  }

  // Start the initial fetch.
  _fetch();

  return {
    data: _data,
    loading: _loading,
    error: _error,

    read(): T {
      if (_loading.peek()) throw _currentPromise;
      const err = _error.peek();
      if (err !== null) throw err;
      return _data.peek() as T;
    },

    refetch: _fetch
  };
}
