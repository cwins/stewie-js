// resource.ts — defineResource + useResource (async data primitive).
//
// defineResource(fn) returns an opaque definition that creates no signals — safe
// to call at module scope and to share across files. useResource(def, source)
// is a free function (matches consume(Context) and useAction(def)) that creates
// the per-component instance owning { data, loading, error } signals scoped to
// the calling component.
//
// The reactive-triggering asymmetry is intrinsic:
//   - resources fire on source change
//   - actions fire on .run()
// These are different primitives; the asymmetry is not incidental.

import { signal, effect, onCleanup, untrack } from './reactive.js';
import type { Signal } from './reactive.js';
import { useDataRegistry, dataRegistryKey } from './data-registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Phantom type-only brand. Variance markers tie S/T into the type so two
// definitions with different signatures are not assignable to each other.
declare const ResourceBrand: unique symbol;

/**
 * An opaque token returned by `defineResource`. Carries no reactive state —
 * safe to create at module scope and share across files. Pass to `useResource`
 * inside a component to create the per-component reactive instance.
 */
export interface ResourceDefinition<S, T> {
  readonly [ResourceBrand]: [(source: S) => void, () => T];
}

// Internal runtime carrier. The brand symbol is type-only; the actual fetcher
// is held under a private symbol so userland cannot read or replace it.
const FN = Symbol('stewie.resource.fn');
const ID = Symbol('stewie.resource.id');

interface InternalResourceDefinition<S, T> extends ResourceDefinition<S, T> {
  readonly [FN]: (source: S, opts: { signal: AbortSignal }) => Promise<T> | T;
  readonly [ID]: string;
}

let _resourceCounter = 0;

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
  error: Signal<Error | null>;
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
// defineResource
// ---------------------------------------------------------------------------

/**
 * Creates a resource definition. Safe at module scope — creates no signals.
 *
 * The fetcher receives the current source value and an `{ signal }` object
 * whose `AbortSignal` is cancelled when:
 * - the source changes and a new fetch begins
 * - `refetch()` is called (stale request aborted before the new one starts)
 * - the owning reactive scope disposes (component unmounts)
 *
 * Pass the signal to `fetch()` so in-flight network requests are cancelled
 * and their results never update the reactive signals:
 *
 * ```ts
 * const fetchUser = defineResource((id: string, { signal }) =>
 *   fetch(`/api/users/${id}`, { signal }).then(r => r.json())
 * )
 * ```
 *
 * Use `useResource(def, source)` inside a component to create the per-component
 * reactive instance.
 */
export interface DefineResourceOptions {
  /**
   * Stable id for this resource, used to namespace its DataRegistry entries.
   * Required for SSR replay to work — server and client must agree on the id
   * so the client can find the SSR-resolved data under the same key. Without
   * an explicit id an auto-counter id is assigned which is *not* stable
   * across SSR and CSR builds; client-side caching still works within a
   * single runtime, but SSR-resolved data will be refetched on hydration.
   */
  id?: string;
}

export function defineResource<S, T>(
  fn: (source: S, opts: { signal: AbortSignal }) => Promise<T> | T,
  options?: DefineResourceOptions
): ResourceDefinition<S, T> {
  const id = options?.id ?? `r${++_resourceCounter}`;
  return { [FN]: fn, [ID]: id } as InternalResourceDefinition<S, T>;
}

// ---------------------------------------------------------------------------
// useResource
// ---------------------------------------------------------------------------

/**
 * Creates a per-component resource instance from a definition. Must be called
 * inside a component or `reactiveScope()` — the signals it creates are owned
 * by that scope and disposed when the scope disposes.
 *
 * `source` is a reactive accessor: `() => S`. The fetcher re-runs whenever the
 * source value changes (tracked via an internal effect). To fetch once with a
 * static value, pass `() => theValue`.
 *
 * **DOM usage (recommended):**
 * ```tsx
 * const fetchUser = defineResource((id: string, { signal }) =>
 *   fetch(`/api/users/${id}`, { signal }).then(r => r.json())
 * )
 *
 * function UserProfile() {
 *   const user = useResource(fetchUser, () => props.id)
 *   return (
 *     <Show when={() => !user.loading()} fallback={<Spinner />}>
 *       <div>{() => user.data()?.name}</div>
 *     </Show>
 *   )
 * }
 * ```
 *
 * **SSR usage with `<Suspense>` and `read()`:**
 * ```tsx
 * function UserProfile() {
 *   const user = useResource(fetchUser, () => props.id)
 *   const data = user.read()  // throws Promise on server; <Suspense> awaits it
 *   return <div>{data.name}</div>
 * }
 * // Wrap with: <Suspense fallback={<Spinner />}><UserProfile /></Suspense>
 * ```
 *
 * Note: For SSR data loading, prefer route-level `load()` functions which run
 * before any rendering begins. `useResource` is most useful for client-side
 * data fetching after the initial page load.
 */
export function useResource<S, T>(def: ResourceDefinition<S, T>, source: () => S): Resource<T> {
  const internal = def as InternalResourceDefinition<S, T>;
  const fn = internal[FN];
  const defId = internal[ID];

  // The DataRegistry — if present in context — is consulted for cache hits
  // before each fetch and written on every successful resolve. On the
  // server it captures resolved data for SSR replay; on the client it
  // dedupes fetches across components and is seeded from the SSR payload
  // before this useResource call runs. Absent (no provider), the resource
  // behaves exactly as before — no caching, no replay.
  const registry = useDataRegistry();

  // Signals are created in the enclosing reactive scope (e.g. a component's
  // reactiveScope) — no need for a wrapper reactiveScope here.
  const _loading = signal<boolean>(true);
  const _data = signal<T | undefined>(undefined);
  const _error = signal<Error | null>(null);

  // _currentPromise is what read() throws for Suspense integration.
  // It resolves on fetch success (so Suspense retries and gets data).
  // It rejects on fetch failure (so Suspense's rejection handler leaves fallback visible).
  let _currentPromise: Promise<void> = Promise.resolve();

  // AbortController for the in-flight request. Replaced on every _fetch() call.
  let _controller = new AbortController();

  function _fetch(sourceValue: S): Promise<void> {
    // Abort the previous in-flight request before starting a new one.
    _controller.abort();
    _controller = new AbortController();
    const abortSignal = _controller.signal;

    // Registry hit short-circuit: if the SSR payload (or a prior client
    // fetch) has already cached this (defId, source) pair, seed the
    // signals synchronously and skip the fetcher entirely. Reads under
    // untrack so the registry's reactive backing doesn't subscribe the
    // calling effect to every entry.
    const cacheKey = registry ? dataRegistryKey(defId, sourceValue) : null;
    if (registry && cacheKey !== null && untrack(() => registry.has(cacheKey))) {
      const cached = untrack(() => registry.get(cacheKey)) as T;
      _data.set(cached);
      _loading.set(false);
      _error.set(null);
      _currentPromise = Promise.resolve();
      return _currentPromise;
    }

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

    Promise.resolve(fn(sourceValue, { signal: abortSignal })).then(
      (data) => {
        // Ignore results from a request that was cancelled (stale refetch or unmount).
        if (abortSignal.aborted) return;
        if (registry && cacheKey !== null) registry.set(cacheKey, data);
        _data.set(data);
        _loading.set(false);
        resolve();
      },
      (err) => {
        if (abortSignal.aborted) return;
        const errObj = err instanceof Error ? err : new Error(String(err));
        _error.set(errObj);
        _loading.set(false);
        reject(errObj);
      }
    );

    return _currentPromise;
  }

  // Track the source and re-fetch when it changes. The effect runs
  // immediately, which fires the initial fetch.
  effect(() => {
    const sourceValue = source();
    _fetch(sourceValue);
  });

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

    refetch(): Promise<void> {
      return _fetch(source());
    }
  };
}
