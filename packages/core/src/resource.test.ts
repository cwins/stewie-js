// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { jsx } from './jsx-runtime.js';
import { reactiveScope } from './reactive.js';
import { Suspense } from './components.js';
import { mount } from './dom-renderer.js';
import { defineResource, useResource } from './resource.js';
import type { Resource } from './resource.js';
import { renderToString } from '@stewie-js/server';

// ---------------------------------------------------------------------------
// defineResource() — no signals at definition time
// ---------------------------------------------------------------------------

describe('defineResource()', () => {
  it('returns an opaque definition that creates no signals', () => {
    const def = defineResource(async (_src: void, _opts: { signal: AbortSignal }) => 42);
    // Definition is a plain value; no reactive state in the returned shape.
    expect((def as { data?: unknown }).data).toBeUndefined();
    expect((def as { loading?: unknown }).loading).toBeUndefined();
    expect((def as { error?: unknown }).error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useResource() — signal API
// ---------------------------------------------------------------------------

describe('useResource() signals', () => {
  it('starts in loading state', () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.resolve(42));
    reactiveScope(() => {
      const res = useResource(def, () => undefined);
      expect(res.loading()).toBe(true);
      expect(res.data()).toBeUndefined();
      expect(res.error()).toBeNull();
    });
  });

  it('resolves data and clears loading', async () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.resolve(42));
    let res!: Resource<number>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });
    expect(res.loading()).toBe(true);
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.data()).toBe(42);
    expect(res.error()).toBeNull();
  });

  it('sets error and clears loading on failure', async () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.reject(new Error('fetch failed')));
    let res!: Resource<number>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.data()).toBeUndefined();
    expect(res.error()).toBeInstanceOf(Error);
    expect(res.error()!.message).toBe('fetch failed');
  });

  it('non-Error rejections are wrapped in new Error()', async () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.reject('plain string error'));
    let res!: Resource<number>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.error()).toBeInstanceOf(Error);
    expect(res.error()!.message).toBe('plain string error');
  });

  it('refetch() re-runs the fetcher and updates signals', async () => {
    let callCount = 0;
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => {
      callCount++;
      return Promise.resolve(callCount * 10);
    });
    let res!: Resource<number>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.data()).toBe(10);
    expect(callCount).toBe(1);

    res.refetch();
    expect(res.loading()).toBe(true);
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.data()).toBe(20);
    expect(callCount).toBe(2);
  });

  it('source value is passed to the fetcher', async () => {
    let receivedSource: string | undefined;
    const def = defineResource((src: string, _opts: { signal: AbortSignal }) => {
      receivedSource = src;
      return Promise.resolve(`data-for-${src}`);
    });
    let res!: Resource<string>;
    reactiveScope(() => {
      res = useResource(def, () => 'user-42');
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(receivedSource).toBe('user-42');
    expect(res.data()).toBe('data-for-user-42');
  });

  it('two useResource() calls on the same definition each get their own instance', async () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.resolve(1));
    reactiveScope(() => {
      const a = useResource(def, () => undefined);
      const b = useResource(def, () => undefined);
      expect(a.data).not.toBe(b.data);
      expect(a.loading).not.toBe(b.loading);
      expect(a.error).not.toBe(b.error);
    });
  });
});

// ---------------------------------------------------------------------------
// useResource().read() — throw-based Suspense API
// ---------------------------------------------------------------------------

describe('useResource().read()', () => {
  it('throws a Promise while loading', () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.resolve(1));
    reactiveScope(() => {
      const res = useResource(def, () => undefined);
      let thrown: unknown;
      try {
        res.read();
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(Promise);
    });
  });

  it('returns data once resolved', async () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.resolve('hello'));
    let res!: Resource<string>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.read()).toBe('hello');
  });

  it('throws the error once rejected', async () => {
    const err = new Error('oops');
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.reject(err));
    let res!: Resource<never>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(() => res.read()).toThrow('oops');
  });
});

// ---------------------------------------------------------------------------
// DOM: Suspense + useResource() — show fallback then content
// ---------------------------------------------------------------------------

// For DOM Suspense + read() to work correctly, the resource must be created
// OUTSIDE the component function so the same instance persists across retries.
// When the Promise resolves, Suspense re-renders; read() now returns data.
describe('Suspense + useResource() DOM rendering', () => {
  it('shows fallback while loading, then shows content', async () => {
    let resolveData!: (v: { name: string }) => void;
    const dataPromise = new Promise<{ name: string }>((resolve) => {
      resolveData = resolve;
    });

    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => dataPromise);

    // Resource created outside component — persists across Suspense retries.
    let res!: Resource<{ name: string }>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });

    function Profile() {
      const user = res.read(); // throws while loading, returns on retry
      return jsx('div', { children: `Hello ${user.name}` });
    }

    const c = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Suspense as any, {
          fallback: jsx('span', { children: 'Loading...' }),
          children: jsx(Profile as any, {})
        }),
        c
      );
    });

    expect(c.textContent).toContain('Loading...');
    expect(c.textContent).not.toContain('Hello');

    resolveData({ name: 'Alice' });
    await vi.waitFor(() => expect(c.textContent).toContain('Hello Alice'));
    expect(c.textContent).not.toContain('Loading...');
  });

  it('leaves fallback visible when resource rejects', async () => {
    let rejectData!: (err: unknown) => void;
    const failPromise = new Promise<never>((_, reject) => {
      rejectData = reject;
    });

    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => failPromise);

    // Resource created outside component.
    let res!: Resource<never>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });

    function BrokenProfile() {
      res.read(); // throws Promise while loading
      return jsx('div', { children: 'content' });
    }

    const c = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Suspense as any, {
          fallback: jsx('span', { children: 'Loading...' }),
          children: jsx(BrokenProfile as any, {})
        }),
        c
      );
    });

    expect(c.textContent).toContain('Loading...');

    rejectData(new Error('network error'));
    // Give it a tick — fallback should stay (rejection handler is a no-op)
    await new Promise((r) => setTimeout(r, 20));
    expect(c.textContent).toContain('Loading...');
  });
});

// ---------------------------------------------------------------------------
// SSR: Suspense + useResource().read() — await thrown Promise, retry
//
// For SSR, the resource must be created OUTSIDE the component function so the
// same instance (and its signals) persists across Suspense retries. If the
// resource is inside the component, each retry creates a new resource and a new
// Promise, which defeats the caching. For production SSR, prefer route-level load().
// ---------------------------------------------------------------------------

describe('Suspense + useResource() SSR rendering', () => {
  it('renders resolved content (not fallback) after awaiting thrown Promise', async () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.resolve('SSR data'));

    // Resource created outside component — same instance is reused on retry.
    let res!: Resource<string>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });

    function DataComponent() {
      const data = res.read(); // throws on first render, returns on retry
      return jsx('span', { children: data });
    }

    const el = jsx(Suspense as any, {
      fallback: jsx('span', { children: 'Loading...' }),
      children: jsx(DataComponent as any, {})
    });
    const { html } = await renderToString(el);
    expect(html).toContain('SSR data');
    expect(html).not.toContain('Loading...');
  });

  it('renders fallback if the fetch rejects', async () => {
    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => Promise.reject(new Error('SSR error')));
    let res!: Resource<string>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });

    function FailingComponent() {
      res.read(); // throws Promise on first render; throws error value on retry
      return jsx('span', { children: 'content' });
    }

    const el = jsx(Suspense as any, {
      fallback: jsx('span', { children: 'Error fallback' }),
      children: jsx(FailingComponent as any, {})
    });
    const { html } = await renderToString(el);
    expect(html).toContain('Error fallback');
    expect(html).not.toContain('content');
  });
});

// ---------------------------------------------------------------------------
// AbortSignal / cancellation
// ---------------------------------------------------------------------------

describe('useResource() AbortSignal and cancellation', () => {
  it('passes an AbortSignal to the fetcher via opts.signal', async () => {
    let receivedSignal: AbortSignal | undefined;
    const def = defineResource((_src: void, opts: { signal: AbortSignal }) => {
      receivedSignal = opts.signal;
      return Promise.resolve(1);
    });
    let res!: Resource<number>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal!.aborted).toBe(false);
    await vi.waitFor(() => expect(res.loading()).toBe(false));
  });

  it('aborts the previous request when refetch() is called', async () => {
    const abortedSignals: AbortSignal[] = [];
    const def = defineResource((_src: void, opts: { signal: AbortSignal }) => {
      // Return a never-resolving promise so we can catch the abort
      return new Promise<number>((_, reject) => {
        opts.signal.addEventListener('abort', () => {
          abortedSignals.push(opts.signal);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    let res!: Resource<number>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });

    // First request is in flight — call refetch() to abort it
    res.refetch();
    // Give the abort event a tick to fire
    await new Promise((r) => setTimeout(r, 0));
    expect(abortedSignals.length).toBe(1);
    expect(abortedSignals[0].aborted).toBe(true);
  });

  it('stale result from aborted refetch is ignored — signals not updated', async () => {
    let resolveFirst!: (v: string) => void;
    let resolveSecond!: (v: string) => void;
    const firstPromise = new Promise<string>((r) => {
      resolveFirst = r;
    });
    const secondPromise = new Promise<string>((r) => {
      resolveSecond = r;
    });
    let call = 0;

    const def = defineResource((_src: void, _opts: { signal: AbortSignal }) => {
      call++;
      return call === 1 ? firstPromise : secondPromise;
    });

    let res!: Resource<string>;
    reactiveScope(() => {
      res = useResource(def, () => undefined);
    });

    // Start a second fetch (aborts first)
    res.refetch();
    // Now resolve the FIRST (stale) promise — result should be discarded
    resolveFirst('stale');
    await new Promise((r) => setTimeout(r, 10));
    // data should still be undefined — stale result was ignored
    expect(res.data()).toBeUndefined();

    // Resolve the second (live) fetch
    resolveSecond('fresh');
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.data()).toBe('fresh');
  });

  it('aborts in-flight request when the owning scope disposes', async () => {
    let receivedSignal!: AbortSignal;
    let dispose!: () => void;
    const def = defineResource((_src: void, opts: { signal: AbortSignal }) => {
      receivedSignal = opts.signal;
      // Never-resolving fetch
      return new Promise<number>(() => {});
    });
    reactiveScope((d) => {
      dispose = d;
      useResource(def, () => undefined);
    });

    expect(receivedSignal.aborted).toBe(false);
    dispose();
    expect(receivedSignal.aborted).toBe(true);
  });
});
