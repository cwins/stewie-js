// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { jsx } from './jsx-runtime.js';
import { createRoot } from './reactive.js';
import { Suspense } from './components.js';
import { mount } from './dom-renderer.js';
import { resource, type Resource } from './resource.js';
import { renderToString } from '@stewie-js/server';

// ---------------------------------------------------------------------------
// resource() — signal API
// ---------------------------------------------------------------------------

describe('resource() signals', () => {
  it('starts in loading state', () => {
    createRoot(() => {
      const res = resource(() => Promise.resolve(42));
      expect(res.loading()).toBe(true);
      expect(res.data()).toBeUndefined();
      expect(res.error()).toBeNull();
    });
  });

  it('resolves data and clears loading', async () => {
    let res!: ReturnType<typeof resource<number>>;
    createRoot(() => {
      res = resource(() => Promise.resolve(42));
    });
    expect(res.loading()).toBe(true);
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.data()).toBe(42);
    expect(res.error()).toBeNull();
  });

  it('sets error and clears loading on failure', async () => {
    let res!: ReturnType<typeof resource<number>>;
    createRoot(() => {
      res = resource(() => Promise.reject(new Error('fetch failed')));
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.data()).toBeUndefined();
    expect(res.error()).toBeInstanceOf(Error);
    expect((res.error() as Error).message).toBe('fetch failed');
  });

  it('refetch() re-runs the fetcher and updates signals', async () => {
    let callCount = 0;
    let res!: ReturnType<typeof resource<number>>;
    createRoot(() => {
      res = resource(() => {
        callCount++;
        return Promise.resolve(callCount * 10);
      });
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
});

// ---------------------------------------------------------------------------
// resource().read() — throw-based Suspense API
// ---------------------------------------------------------------------------

describe('resource().read()', () => {
  it('throws a Promise while loading', () => {
    createRoot(() => {
      const res = resource(() => Promise.resolve(1));
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
    let res!: ReturnType<typeof resource<string>>;
    createRoot(() => {
      res = resource(() => Promise.resolve('hello'));
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(res.read()).toBe('hello');
  });

  it('throws the error once rejected', async () => {
    const err = new Error('oops');
    let res!: ReturnType<typeof resource<never>>;
    createRoot(() => {
      res = resource(() => Promise.reject(err));
    });
    await vi.waitFor(() => expect(res.loading()).toBe(false));
    expect(() => res.read()).toThrow('oops');
  });
});

// ---------------------------------------------------------------------------
// DOM: Suspense + resource() — show fallback then content
// ---------------------------------------------------------------------------

// For DOM Suspense + read() to work correctly, the resource must be created
// OUTSIDE the component function so the same instance persists across retries.
// When the Promise resolves, Suspense re-renders; read() now returns data.
describe('Suspense + resource() DOM rendering', () => {
  it('shows fallback while loading, then shows content', async () => {
    let resolveData!: (v: { name: string }) => void;
    const dataPromise = new Promise<{ name: string }>((resolve) => {
      resolveData = resolve;
    });

    // Resource created outside component — persists across Suspense retries.
    let res!: Resource<{ name: string }>;
    createRoot(() => {
      res = resource(() => dataPromise);
    });

    function Profile() {
      const user = res.read(); // throws while loading, returns on retry
      return jsx('div', { children: `Hello ${user.name}` });
    }

    const c = document.createElement('div');
    createRoot(() => {
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

    // Resource created outside component.
    let res!: Resource<never>;
    createRoot(() => {
      res = resource(() => failPromise);
    });

    function BrokenProfile() {
      res.read(); // throws Promise while loading
      return jsx('div', { children: 'content' });
    }

    const c = document.createElement('div');
    createRoot(() => {
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
// SSR: Suspense + resource().read() — await thrown Promise, retry
//
// For SSR, the resource must be created OUTSIDE the component function so the
// same instance (and its signals) persists across Suspense retries. If resource()
// is inside the component, each retry creates a new resource and a new Promise,
// which defeats the caching. For production SSR, prefer route-level load().
// ---------------------------------------------------------------------------

describe('Suspense + resource() SSR rendering', () => {
  it('renders resolved content (not fallback) after awaiting thrown Promise', async () => {
    // Resource created outside component — same instance is reused on retry.
    let res!: Resource<string>;
    createRoot(() => {
      res = resource(() => Promise.resolve('SSR data'));
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
    let res!: Resource<string>;
    createRoot(() => {
      res = resource(() => Promise.reject(new Error('SSR error')));
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

describe('resource() AbortSignal and cancellation', () => {
  it('passes an AbortSignal to the fetcher', async () => {
    let receivedSignal: AbortSignal | undefined;
    let res!: ReturnType<typeof resource<number>>;
    createRoot(() => {
      res = resource((signal) => {
        receivedSignal = signal;
        return Promise.resolve(1);
      });
    });
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal!.aborted).toBe(false);
    await vi.waitFor(() => expect(res.loading()).toBe(false));
  });

  it('aborts the previous request when refetch() is called', async () => {
    const abortedSignals: AbortSignal[] = [];
    let res!: ReturnType<typeof resource<number>>;
    createRoot(() => {
      res = resource((signal) => {
        // Return a never-resolving promise so we can catch the abort
        return new Promise<number>((_, reject) => {
          signal.addEventListener('abort', () => {
            abortedSignals.push(signal);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });
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

    let res!: ReturnType<typeof resource<string>>;
    createRoot(() => {
      res = resource(() => {
        call++;
        return call === 1 ? firstPromise : secondPromise;
      });
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
    createRoot((d) => {
      dispose = d;
      resource((signal) => {
        receivedSignal = signal;
        // Never-resolving fetch
        return new Promise<number>(() => {});
      });
    });

    expect(receivedSignal.aborted).toBe(false);
    dispose();
    expect(receivedSignal.aborted).toBe(true);
  });
});
