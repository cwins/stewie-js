import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRouter, useRouter, RouterContext } from './router.js';
import { provide, effect } from '@stewie-js/core';

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

  it('calls document.startViewTransition when available', () => {
    const transition = vi.fn((fn: () => void) => {
      fn();
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
  it('stores loaded data in _routeData signal after navigation', async () => {
    const router = createRouter('/');
    router._routes = [
      {
        path: '/data',
        component: null as any,
        load: async () => ({ items: [1, 2, 3] })
      }
    ];
    await router.navigate('/data');
    expect(router._routeData()).toEqual({ items: [1, 2, 3] });
  });

  it('resets _routeData to undefined before loading', async () => {
    const router = createRouter('/');
    let duringLoad: unknown = 'not-checked';
    router._routes = [
      {
        path: '/a',
        component: null as any,
        load: async () => {
          duringLoad = router._routeData();
          return 'done';
        }
      }
    ];
    await router.navigate('/a');
    expect(duringLoad).toBeUndefined();
    expect(router._routeData()).toBe('done');
  });

  it('clears _routeData when navigating to a route with no loader', async () => {
    const router = createRouter('/');
    router._routes = [
      { path: '/with-data', component: null as any, load: async () => ({ value: 42 }) },
      { path: '/no-data', component: null as any }
    ];
    await router.navigate('/with-data');
    expect(router._routeData()).toEqual({ value: 42 });

    await router.navigate('/no-data');
    // Stale data from the previous route must not bleed through
    expect(router._routeData()).toBeUndefined();
  });
});
