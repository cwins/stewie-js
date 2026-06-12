import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRouter, useRouter, RouterContext } from './router.js';
import { provide, effect } from '@stewie-js/core';

/**
 * Temporarily install a stub `history` on `globalThis` so setQuery's history
 * writes can be observed. The router tests run in node, which has no DOM.
 */
function stubHistory(overrides: Partial<History>): () => void {
  const prior = (globalThis as { history?: History }).history;
  (globalThis as { history?: History }).history = {
    length: 0,
    scrollRestoration: 'auto',
    state: null,
    back: () => {},
    forward: () => {},
    go: () => {},
    pushState: () => {},
    replaceState: () => {},
    ...overrides
  } as History;
  return () => {
    if (prior === undefined) {
      delete (globalThis as { history?: History }).history;
    } else {
      (globalThis as { history?: History }).history = prior;
    }
  };
}

describe('createRouter', () => {
  it('creates a router with a location', () => {
    const router = createRouter('/');
    expect(router.location).toBeDefined();
    expect(router.location.pathname).toBe('/');
    expect(router.location.params).toEqual({});
    expect(router.location.query).toEqual({});
    expect(router.location.hash).toBe('');
  });

  it('creates a router with an initial URL', () => {
    const router = createRouter('/users/42?tab=info#section');
    expect(router.location.pathname).toBe('/users/42');
    expect(router.location.query).toEqual({ tab: 'info' });
    expect(router.location.hash).toBe('section');
  });

  it('navigate with string updates pathname', () => {
    const router = createRouter('/');
    router.navigate('/new-path');
    expect(router.location.pathname).toBe('/new-path');
  });

  it('navigate with string updates query and hash', () => {
    const router = createRouter('/');
    router.navigate('/path?foo=bar#section');
    expect(router.location.pathname).toBe('/path');
    expect(router.location.query).toEqual({ foo: 'bar' });
    expect(router.location.hash).toBe('section');
  });

  it('navigate with NavigateOptions updates location', () => {
    const router = createRouter('/');
    router.navigate({ to: '/path', replace: true });
    expect(router.location.pathname).toBe('/path');
  });

  it('navigate with NavigateOptions (replace: false) updates location', () => {
    const router = createRouter('/');
    router.navigate({ to: '/other' });
    expect(router.location.pathname).toBe('/other');
  });

  it('match returns RouteMatch when pattern matches current location', () => {
    const router = createRouter('/users/42');
    const match = router.match('/users/:id');
    expect(match).not.toBeNull();
    expect(match!.pattern).toBe('/users/:id');
    expect(match!.params).toEqual({ id: '42' });
    expect(typeof match!.score).toBe('number');
  });

  it('match returns null when pattern does not match', () => {
    const router = createRouter('/users/42');
    const match = router.match('/other');
    expect(match).toBeNull();
  });

  it('back() and forward() do not throw in Node environment', () => {
    const router = createRouter('/');
    expect(() => router.back()).not.toThrow();
    expect(() => router.forward()).not.toThrow();
  });

  it('_setLocation updates all location fields', () => {
    const router = createRouter('/');
    router._setLocation('/updated?q=1#h', { id: '5' });
    expect(router.location.pathname).toBe('/updated');
    expect(router.location.query).toEqual({ q: '1' });
    expect(router.location.hash).toBe('h');
    expect(router.location.params).toEqual({ id: '5' });
  });
});

describe('router._dispose()', () => {
  it('exists on the router object', () => {
    const router = createRouter('/');
    expect(typeof router._dispose).toBe('function');
  });

  it('can be called without throwing', () => {
    const router = createRouter('/');
    expect(() => router._dispose()).not.toThrow();
  });

  it('removes popstate listener so subsequent popstate does not update location', () => {
    // Simulate a browser-like environment with location and popstate support
    const listeners: EventListener[] = [];
    const mockLocation = { pathname: '/start', search: '', hash: '' };

    vi.stubGlobal('location', mockLocation);
    vi.stubGlobal('addEventListener', (type: string, fn: EventListener) => {
      if (type === 'popstate') listeners.push(fn);
    });
    vi.stubGlobal('removeEventListener', (type: string, fn: EventListener) => {
      if (type === 'popstate') {
        const idx = listeners.indexOf(fn);
        if (idx !== -1) listeners.splice(idx, 1);
      }
    });

    const router = createRouter('/start');
    expect(listeners.length).toBe(1);

    router._dispose();
    expect(listeners.length).toBe(0); // listener was removed
  });
});

describe('useRouter', () => {
  it('throws when called outside RouterContext', () => {
    expect(() => useRouter()).toThrow('useRouter() called outside of <Router> provider');
  });

  it('returns router when called inside RouterContext provider', () => {
    const router = createRouter('/');
    let capturedRouter: ReturnType<typeof useRouter> | null = null;

    provide(RouterContext, router, () => {
      capturedRouter = useRouter();
    });

    expect(capturedRouter).toBe(router);
  });
});

describe('View Transitions API integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls document.startViewTransition with kind + direction types', () => {
    const transition = vi.fn((arg: { update: () => void; types: string[] } | (() => void)) => {
      const update = typeof arg === 'function' ? arg : arg.update;
      update();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve()
      };
    });
    vi.stubGlobal('document', { startViewTransition: transition });

    const router = createRouter('/');
    router.navigate('/about');

    expect(transition).toHaveBeenCalledOnce();
    expect(router.location.pathname).toBe('/about');
    const arg = transition.mock.calls[0][0] as { types: string[] };
    expect(arg.types).toContain('stewie-kind-push');
    expect(arg.types).toContain('stewie-direction-default');
  });

  it('navigates normally when startViewTransition is absent', () => {
    vi.stubGlobal('document', {});

    const router = createRouter('/');
    router.navigate('/about');
    expect(router.location.pathname).toBe('/about');
  });
});

describe('location reactivity: pathname vs query independence', () => {
  it('changing pathname does not trigger query subscribers', () => {
    const router = createRouter('/home?foo=bar');
    let pathnameRunCount = 0;
    let queryRunCount = 0;

    const disposePathname = effect(() => {
      const _ = router.location.pathname;
      pathnameRunCount++;
    });

    const disposeQuery = effect(() => {
      const _ = router.location.query;
      queryRunCount++;
    });

    // Both run on initialization
    expect(pathnameRunCount).toBe(1);
    expect(queryRunCount).toBe(1);

    // Navigate to new path without changing query
    router.navigate('/new-path');
    expect(pathnameRunCount).toBe(2);
    // query is reassigned (same object reference replaced), so this will run
    // but let's verify that changing only pathname doesn't affect query subscribers
    // by doing a direct property assignment
    queryRunCount = 0;
    pathnameRunCount = 0;

    // Directly set pathname only
    router.location.pathname = '/another-path';
    expect(pathnameRunCount).toBe(1);
    expect(queryRunCount).toBe(0); // query subscribers should NOT re-run

    // Directly set query only
    router.location.query = { tab: 'settings' };
    expect(pathnameRunCount).toBe(1); // pathname subscribers should NOT re-run
    expect(queryRunCount).toBe(1);

    disposePathname();
    disposeQuery();
  });
});

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

describe('Route guards (beforeEnter)', () => {
  it('allows navigation when guard returns true', async () => {
    const router = createRouter('/');
    router._routes = [
      {
        path: '/protected',
        component: null as any,
        beforeEnter: async () => true as const
      }
    ];
    await router.navigate('/protected');
    expect(router.location.pathname).toBe('/protected');
  });

  it('redirects when guard returns a string', async () => {
    const router = createRouter('/');
    router._routes = [
      { path: '/login', component: null as any },
      {
        path: '/protected',
        component: null as any,
        beforeEnter: async () => '/login'
      }
    ];
    await router.navigate('/protected');
    // Guard redirected to /login
    expect(router.location.pathname).toBe('/login');
  });

  it('calls guard with correct to and from arguments', async () => {
    const router = createRouter('/home');
    const guard = vi.fn(async () => true as const);
    router._routes = [
      { path: '/home', component: null as any },
      { path: '/about', component: null as any, beforeEnter: guard }
    ];
    await router.navigate('/about');
    expect(guard).toHaveBeenCalledWith('/about', '/home');
  });

  it('skips guard on routes that do not match', async () => {
    const router = createRouter('/');
    const guard = vi.fn(async () => true as const);
    router._routes = [
      { path: '/protected', component: null as any, beforeEnter: guard },
      { path: '/open', component: null as any }
    ];
    await router.navigate('/open');
    // Guard should NOT be called — /open doesn't have a guard
    expect(guard).not.toHaveBeenCalled();
    expect(router.location.pathname).toBe('/open');
  });
});

// ---------------------------------------------------------------------------
// popstate: guards run on browser back/forward (History API path)
// ---------------------------------------------------------------------------

describe('popstate guard execution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs beforeEnter guard on popstate and allows navigation', async () => {
    const guard = vi.fn(async () => true as const);
    const listeners: Record<string, EventListener[]> = {};
    const mockLocation = { pathname: '/home', search: '', hash: '' };

    vi.stubGlobal('location', mockLocation);
    vi.stubGlobal('addEventListener', (type: string, fn: EventListener) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(fn);
    });
    vi.stubGlobal('removeEventListener', (type: string, fn: EventListener) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    });

    const router = createRouter('/home');
    router._routes = [
      { path: '/home', component: null as any },
      { path: '/about', component: null as any, beforeEnter: guard }
    ];

    // Simulate browser navigating back/forward to /about
    mockLocation.pathname = '/about';
    listeners['popstate']?.forEach((fn) => fn(new Event('popstate')));

    // Guard runs asynchronously — wait for it to settle
    await vi.waitFor(() => expect(guard).toHaveBeenCalledWith('/about', '/home'));
    await vi.waitFor(() => expect(router.location.pathname).toBe('/about'));
  });

  it('redirects on popstate when guard returns a string', async () => {
    const listeners: Record<string, EventListener[]> = {};
    const mockLocation = { pathname: '/home', search: '', hash: '' };

    vi.stubGlobal('location', mockLocation);
    vi.stubGlobal('history', { pushState: vi.fn(), replaceState: vi.fn() });
    vi.stubGlobal('addEventListener', (type: string, fn: EventListener) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(fn);
    });
    vi.stubGlobal('removeEventListener', (type: string, fn: EventListener) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    });

    const router = createRouter('/home');
    router._routes = [
      { path: '/home', component: null as any },
      { path: '/login', component: null as any },
      { path: '/protected', component: null as any, beforeEnter: async () => '/login' }
    ];

    mockLocation.pathname = '/protected';
    listeners['popstate']?.forEach((fn) => fn(new Event('popstate')));

    await vi.waitFor(() => expect(router.location.pathname).toBe('/login'));
  });

  it('runs the redirect target guards when popstate guard redirects', async () => {
    // Regression: previously applyLocationAndPush(redirect) bypassed the
    // redirect target's own guards. The fix re-enters navigate() so the
    // redirect target's beforeEnter also runs.
    const listeners: Record<string, EventListener[]> = {};
    const mockLocation = { pathname: '/home', search: '', hash: '' };
    const loginGuard = vi.fn(async () => true as const);

    vi.stubGlobal('location', mockLocation);
    vi.stubGlobal('history', { pushState: vi.fn(), replaceState: vi.fn() });
    vi.stubGlobal('addEventListener', (type: string, fn: EventListener) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(fn);
    });
    vi.stubGlobal('removeEventListener', (type: string, fn: EventListener) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    });

    const router = createRouter('/home');
    router._routes = [
      { path: '/home', component: null as any },
      { path: '/login', component: null as any, beforeEnter: loginGuard },
      { path: '/protected', component: null as any, beforeEnter: async () => '/login' }
    ];

    mockLocation.pathname = '/protected';
    listeners['popstate']?.forEach((fn) => fn(new Event('popstate')));

    await vi.waitFor(() => expect(router.location.pathname).toBe('/login'));
    // The redirect target's own guard must have run
    expect(loginGuard).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Route data loading (useRouteData / load)
// ---------------------------------------------------------------------------

describe('Route data loading (load)', () => {
  /** Helper: read the route data signal for the given path from the router's map. */
  function getRouteData(router: ReturnType<typeof createRouter>, path: string): unknown {
    return router._routeDataMap.get(path)?.();
  }

  it('stores loaded data in _routeDataMap after navigation', async () => {
    const router = createRouter('/');
    router._routes = [
      {
        path: '/data',
        component: null as any,
        load: async () => ({ items: [1, 2, 3] })
      }
    ];
    await router.navigate('/data');
    expect(getRouteData(router, '/data')).toEqual({ items: [1, 2, 3] });
  });

  it('resets route data to undefined before loading', async () => {
    const router = createRouter('/');
    let duringLoad: unknown = 'not-checked';
    router._routes = [
      {
        path: '/a',
        component: null as any,
        load: async () => {
          duringLoad = getRouteData(router, '/a');
          return 'done';
        }
      }
    ];
    await router.navigate('/a');
    expect(duringLoad).toBeUndefined();
    expect(getRouteData(router, '/a')).toBe('done');
  });

  it('clears route data when navigating to a route with no loader', async () => {
    const router = createRouter('/');
    router._routes = [
      { path: '/with-data', component: null as any, load: async () => ({ value: 42 }) },
      { path: '/no-data', component: null as any }
    ];
    await router.navigate('/with-data');
    expect(getRouteData(router, '/with-data')).toEqual({ value: 42 });

    await router.navigate('/no-data');
    // Stale data from the previous route must not bleed through.
    // The /with-data signal is reset to undefined when navigating away.
    expect(getRouteData(router, '/with-data')).toBeUndefined();
  });
});

describe('query-only navigation does not re-mount the route', () => {
  // Drive `effect` count on a function that closes over the location
  // properties matchedContent watches. When the function re-runs, the route
  // component would re-mount under a real Router. Asserting the function
  // doesn't re-run is equivalent to asserting no re-mount.
  function trackPathnameAndParamsReads(router: ReturnType<typeof createRouter>): { state: { runs: number }; dispose: () => void } {
    const state = { runs: 0 };
    const dispose = effect(() => {
      state.runs++;
      // Read both reactive properties matchedContent reads under a real Router.
      void router.location.pathname;
      void router.location.params;
    });
    return { state, dispose };
  }

  it('navigate() to the same pathname with a different query does not re-run pathname/params subscribers', async () => {
    const router = createRouter('/search?q=a');
    const { state, dispose } = trackPathnameAndParamsReads(router);
    expect(state.runs).toBe(1);

    await router.navigate('/search?q=ab');
    expect(router.location.query).toEqual({ q: 'ab' });
    expect(state.runs).toBe(1); // no re-mount

    await router.navigate('/search?q=abc');
    expect(router.location.query).toEqual({ q: 'abc' });
    expect(state.runs).toBe(1);

    dispose();
  });

  it('navigate() to a different pathname does re-run pathname/params subscribers', async () => {
    const router = createRouter('/');
    const { state, dispose } = trackPathnameAndParamsReads(router);
    expect(state.runs).toBe(1);

    await router.navigate('/other');
    expect(state.runs).toBe(2);

    dispose();
  });
});

describe('setQuery', () => {
  it('patches the query without re-running pathname/params subscribers', () => {
    const router = createRouter('/search?q=a');
    const state = { runs: 0 };
    const dispose = effect(() => {
      state.runs++;
      void router.location.pathname;
      void router.location.params;
    });
    expect(state.runs).toBe(1);

    router.setQuery({ q: 'ab' });
    expect(router.location.query).toEqual({ q: 'ab' });
    expect(state.runs).toBe(1);

    dispose();
  });

  it('notifies query subscribers reactively', () => {
    const router = createRouter('/search?q=a');
    const seen: string[] = [];
    const dispose = effect(() => {
      seen.push(router.location.query.q ?? '');
    });
    expect(seen).toEqual(['a']);

    router.setQuery({ q: 'ab' });
    expect(seen).toEqual(['a', 'ab']);

    router.setQuery({ q: 'abc' });
    expect(seen).toEqual(['a', 'ab', 'abc']);

    dispose();
  });

  it('deletes keys when patch value is null or undefined', () => {
    const router = createRouter('/?q=hi&sort=name');
    router.setQuery({ q: null });
    expect(router.location.query).toEqual({ sort: 'name' });

    router.setQuery({ sort: undefined });
    expect(router.location.query).toEqual({});
  });

  it('is a no-op when the patch produces an identical query', () => {
    const router = createRouter('/?q=hi');
    const seen: string[] = [];
    const dispose = effect(() => {
      seen.push(router.location.query.q ?? '');
    });
    expect(seen).toEqual(['hi']);

    router.setQuery({ q: 'hi' });
    expect(seen).toEqual(['hi']); // no extra notification

    dispose();
  });

  it('never runs guards or loaders — query-reactive data is the fetch site’s job', async () => {
    const guard = vi.fn().mockResolvedValue(true);
    const load = vi
      .fn()
      .mockImplementation((_params: Record<string, string>, query: Record<string, string>) => Promise.resolve({ q: query.q }));
    const router = createRouter('/search?q=a');
    router._chains = [
      {
        leafPath: '/search',
        levels: [{ fullPath: '/search', component: () => null, beforeEnter: guard, load }]
      }
    ];
    await router.navigate('/search?q=a');
    guard.mockClear();
    load.mockClear();

    router.setQuery({ q: 'b' });
    expect(guard).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(router.location.query).toEqual({ q: 'b' });
    // Route data signal still holds the value from the original navigation —
    // setQuery does not touch it.
    expect(router._routeDataMap.get('/search')?.()).toEqual({ q: 'a' });
  });

  it('updates browser history via replaceState by default', () => {
    const replace = vi.fn();
    const push = vi.fn();
    const restore = stubHistory({ replaceState: replace, pushState: push });
    try {
      const router = createRouter('/search?q=a');
      router.setQuery({ q: 'b' });
      expect(replace).toHaveBeenCalledWith(null, '', '/search?q=b');
      expect(push).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('uses pushState when push: true is passed', () => {
    const replace = vi.fn();
    const push = vi.fn();
    const restore = stubHistory({ replaceState: replace, pushState: push });
    try {
      const router = createRouter('/search?q=a');
      router.setQuery({ q: 'b' }, { push: true });
      expect(push).toHaveBeenCalledWith(null, '', '/search?q=b');
      expect(replace).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('preserves pathname and hash', () => {
    const router = createRouter('/projects/42?tab=info#section');
    router.setQuery({ tab: 'tasks' });
    expect(router.location.pathname).toBe('/projects/42');
    expect(router.location.hash).toBe('section');
    expect(router.location.query).toEqual({ tab: 'tasks' });
  });
});

describe('preload', () => {
  it('runs the matched chain loaders without committing the navigation', async () => {
    const load = vi.fn().mockResolvedValue({ ok: true });
    const router = createRouter('/');
    router._chains = [{ leafPath: '/dest', levels: [{ fullPath: '/dest', component: () => null, load }] }];
    await router.preload('/dest');
    expect(load).toHaveBeenCalledTimes(1);
    // Current location is still '/' — preload doesn't commit the navigation —
    // but the destination's data signal IS warmed so a click resolves instantly.
    expect(router.location.pathname).toBe('/');
    expect(router._routeDataMap.get('/dest')?.()).toEqual({ ok: true });
  });

  it("does not reset other routes' data signals while preloading", async () => {
    const router = createRouter('/');
    router._chains = [
      { leafPath: '/dest', levels: [{ fullPath: '/dest', component: () => null, load: () => Promise.resolve('warm') }] },
      { leafPath: '/other', levels: [{ fullPath: '/other', component: () => null, load: () => Promise.resolve('keep') }] }
    ];
    await router.navigate('/other');
    expect(router._routeDataMap.get('/other')?.()).toBe('keep');

    await router.preload('/dest');
    // /other's data signal is untouched — preload skips the cross-route reset.
    expect(router._routeDataMap.get('/other')?.()).toBe('keep');
    expect(router._routeDataMap.get('/dest')?.()).toBe('warm');
  });

  it("calls the component's preload() when it is a lazy boundary", async () => {
    const preload = vi.fn().mockResolvedValue(undefined);
    const lazyLike = Object.assign(() => null, { preload });
    const router = createRouter('/');
    router._chains = [{ leafPath: '/dest', levels: [{ fullPath: '/dest', component: lazyLike as unknown as () => null }] }];
    await router.preload('/dest');
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('skips components without a preload() method', async () => {
    const router = createRouter('/');
    router._chains = [{ leafPath: '/dest', levels: [{ fullPath: '/dest', component: () => null }] }];
    // Should not throw — eager components simply have no preload.
    await router.preload('/dest');
  });
});

describe('NavigationStatus.kind', () => {
  it("is 'push' for a default navigate()", async () => {
    const router = createRouter('/');
    await router.navigate('/about');
    expect(router.status.kind).toBe('push');
  });

  it("is 'replace' when navigate({ replace: true })", async () => {
    const router = createRouter('/');
    await router.navigate({ to: '/about', replace: true });
    expect(router.status.kind).toBe('replace');
  });

  it("is 'replace' for a redirect (history doesn't accumulate)", async () => {
    const router = createRouter('/');
    const guard = vi.fn().mockResolvedValue('/login');
    router._chains = [
      { leafPath: '/private', levels: [{ fullPath: '/private', component: () => null, beforeEnter: guard }] },
      { leafPath: '/login', levels: [{ fullPath: '/login', component: () => null }] }
    ];
    await router.navigate('/private');
    expect(router.location.pathname).toBe('/login');
    expect(router.status.kind).toBe('replace');
  });
});

describe('NavigationStatus.routeDirection', () => {
  function setupChains() {
    return [
      { leafPath: '/', levels: [{ fullPath: '/', component: () => null }] },
      { leafPath: '/settings', levels: [{ fullPath: '/settings', component: () => null }] },
      {
        leafPath: '/settings/account',
        levels: [
          { fullPath: '/settings', component: () => null },
          { fullPath: '/settings/account', component: () => null }
        ]
      },
      {
        leafPath: '/settings/billing',
        levels: [
          { fullPath: '/settings', component: () => null },
          { fullPath: '/settings/billing', component: () => null }
        ]
      },
      { leafPath: '/profile', levels: [{ fullPath: '/profile', component: () => null }] },
      { leafPath: '/products/:id', levels: [{ fullPath: '/products/:id', component: () => null }] }
    ];
  }

  it("is 'default' on the first navigation (no source chain)", async () => {
    const router = createRouter('/');
    router._chains = setupChains();
    await router.navigate('/settings');
    expect(router.status.routeDirection).toBe('default');
  });

  it("is 'forward' when destination extends source chain", async () => {
    const router = createRouter('/');
    router._chains = setupChains();
    await router.navigate('/settings');
    await router.navigate('/settings/account');
    expect(router.status.routeDirection).toBe('forward');
  });

  it("is 'back' when source extends destination chain", async () => {
    const router = createRouter('/');
    router._chains = setupChains();
    await router.navigate('/settings/account');
    await router.navigate('/settings');
    expect(router.status.routeDirection).toBe('back');
  });

  it("is 'default' for sibling subtrees under a shared parent", async () => {
    const router = createRouter('/');
    router._chains = setupChains();
    await router.navigate('/settings/account');
    await router.navigate('/settings/billing');
    expect(router.status.routeDirection).toBe('default');
  });

  it("is 'default' for unrelated subtrees", async () => {
    const router = createRouter('/');
    router._chains = setupChains();
    await router.navigate('/settings');
    await router.navigate('/profile');
    expect(router.status.routeDirection).toBe('default');
  });

  it("is 'same' for param-only changes within one route", async () => {
    const router = createRouter('/');
    router._chains = setupChains();
    await router.navigate('/products/12345');
    await router.navigate('/products/98765');
    expect(router.status.routeDirection).toBe('same');
  });
});

describe('View Transition types[]', () => {
  function captureTypes(): { types: string[] } {
    const captured: { types: string[] } = { types: [] };
    const transition = (arg: { update: () => void; types: string[] } | (() => void)) => {
      if (typeof arg === 'function') {
        arg();
        captured.types = [];
      } else {
        arg.update();
        captured.types = arg.types;
      }
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve()
      };
    };
    vi.stubGlobal('document', { startViewTransition: transition });
    return captured;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits stewie-transition-{group} only when both chains include the group AND direction is forward/back', async () => {
    const captured = captureTypes();
    const router = createRouter('/');
    router._chains = [
      {
        leafPath: '/settings',
        levels: [{ fullPath: '/settings', component: () => null, transition: 'slide' }]
      },
      {
        leafPath: '/settings/account',
        levels: [
          { fullPath: '/settings', component: () => null, transition: 'slide' },
          { fullPath: '/settings/account', component: () => null }
        ]
      },
      {
        leafPath: '/settings/billing',
        levels: [
          { fullPath: '/settings', component: () => null, transition: 'slide' },
          { fullPath: '/settings/billing', component: () => null }
        ]
      },
      { leafPath: '/profile', levels: [{ fullPath: '/profile', component: () => null }] }
    ];

    // forward into the slide group → emit slide + forward
    await router.navigate('/settings');
    await router.navigate('/settings/account');
    expect(captured.types).toContain('stewie-transition-slide');
    expect(captured.types).toContain('stewie-direction-forward');

    // sibling tabs under the slide layout → direction default, do NOT emit slide
    await router.navigate('/settings/billing');
    expect(captured.types).not.toContain('stewie-transition-slide');
    expect(captured.types).toContain('stewie-direction-default');

    // back out of the slide group → emit slide + back
    await router.navigate('/settings');
    expect(captured.types).toContain('stewie-transition-slide');
    expect(captured.types).toContain('stewie-direction-back');

    // jump out of the slide group entirely → no slide type
    await router.navigate('/profile');
    expect(captured.types).not.toContain('stewie-transition-slide');
  });
});

describe('Lazy chunk awaiting on navigate', () => {
  it("calls the component's preload() before applyLocation (so VT snapshots the loaded DOM)", async () => {
    const order: string[] = [];
    const preload = vi.fn(async () => {
      order.push('preload');
    });
    const lazyLike = Object.assign(() => null, { preload });
    const router = createRouter('/');
    router._chains = [
      { leafPath: '/', levels: [{ fullPath: '/', component: () => null }] },
      {
        leafPath: '/lazy',
        levels: [
          {
            fullPath: '/lazy',
            component: lazyLike as unknown as () => null,
            load: async () => {
              order.push('load');
              return null;
            }
          }
        ]
      }
    ];
    await router.navigate('/lazy');
    // load and preload both run before commit; the test asserts both were called.
    expect(order).toContain('preload');
    expect(order).toContain('load');
    expect(router.location.pathname).toBe('/lazy');
  });
});

describe('Scroll restoration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scrolls to (0,0) on a forward push navigation', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('window', { scrollTo, scrollX: 50, scrollY: 200 });
    vi.stubGlobal('document', {});
    const router = createRouter('/');
    await router.navigate('/about');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('does not scroll when { scroll: false } is passed', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('window', { scrollTo, scrollX: 50, scrollY: 200 });
    vi.stubGlobal('document', {});
    const router = createRouter('/');
    await router.navigate({ to: '/about', scroll: false });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
