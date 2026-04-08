// resource.ts — async resource primitive

import { signal, onCleanup } from './reactive.js';
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
   * Re-invoke the fetcher. Aborts any in-flight request before starting the new
   * one. Returns a Promise that resolves when the new fetch completes.
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
 * The fetcher receives an `AbortSignal` that is cancelled when:
 * - `refetch()` is called (stale request is aborted before the new one starts)
 * - The owning reactive scope is disposed (component unmounts)
 *
 * Pass the signal to `fetch()` so in-flight network requests are cancelled
 * and their results never update signals:
 *
 * **DOM usage (recommended):**
 * ```tsx
 * function UserProfile() {
 *   const user = resource((signal) => fetch('/api/me', { signal }).then(r => r.json()))
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
 *   const user = resource((signal) => fetch('/api/me', { signal }).then(r => r.json()))
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
export function resource<T>(fetcher: (signal: AbortSignal) => Promise<T>): Resource<T> {
  // Signals are created in the enclosing reactive scope (e.g. a component's
  // reactiveScope) — no need for a wrapper reactiveScope here.
  const _loading = signal<boolean>(true);
  const _data = signal<T | undefined>(undefined);
  const _error = signal<unknown>(null);

  // _currentPromise is what read() throws for Suspense integration.
  // It resolves on fetch success (so Suspense retries and gets data).
  // It rejects on fetch failure (so Suspense's rejection handler leaves fallback visible).
  let _currentPromise: Promise<void> = Promise.resolve();

  // AbortController for the in-flight request. Replaced on every _fetch() call.
  let _controller = new AbortController();

  function _fetch(): Promise<void> {
    // Abort the previous in-flight request before starting a new one.
    _controller.abort();
    _controller = new AbortController();
    const abortSignal = _controller.signal;

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

    fetcher(abortSignal).then(
      (data) => {
        // Ignore results from a request that was cancelled (stale refetch or unmount).
        if (abortSignal.aborted) return;
        _data.set(data);
        _loading.set(false);
        resolve();
      },
      (err) => {
        if (abortSignal.aborted) return;
        _error.set(err);
        _loading.set(false);
        reject(err);
      }
    );

    return _currentPromise;
  }

  // Start the initial fetch.
  _fetch();

  // Cancel in-flight request when the owning reactive scope (component) disposes.
  onCleanup(() => _controller.abort());

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
