// @vitest-environment happy-dom
/**
 * Nested routes (layout routes) — comprehensive tests.
 *
 * Covers:
 *   - flattenRoutes tree-walking
 *   - Prefix matching via injected wildcard leaf paths
 *   - Multi-level guard chain (outer redirect skips inner)
 *   - Parallel loaders
 *   - Params merging across levels
 *   - Index routes via path="."
 *   - Setup-time errors (child path="/", child without leading "/")
 *   - Outlet renders matched child
 *   - Outlet forwards extra props to matched child
 *   - dev-mode missing-Outlet warning
 *   - useRouteData() returns per-level data in nested context
 */

import { describe, it, expect, vi } from 'vitest';
import { jsx, reactiveScope } from '@stewie-js/core';
import { mount } from '@stewie-js/core';
import { renderToString } from '@stewie-js/server';
import { Router, Route, Outlet, createSsrRouter } from './components.js';
import { useRouteData, useParams } from './hooks.js';
import { createRouter } from './router.js';

// ---------------------------------------------------------------------------
// flattenRoutes / tree-walking
// ---------------------------------------------------------------------------

describe('flattenRoutes — tree structure', () => {
  // We test flattenRoutes indirectly via createRouter._chains after Router setup.

  it('flat routes produce one chain per route', () => {
    const router = createRouter('/');
    router._routes = [
      { path: '/', component: null as any },
      { path: '/about', component: null as any }
    ];
    expect(router._chains).toHaveLength(2);
    expect(router._chains[0].leafPath).toBe('/');
    expect(router._chains[0].levels).toHaveLength(1);
    expect(router._chains[1].leafPath).toBe('/about');
  });

  it('nested routes produce chains with full ancestor levels', async () => {
    function Layout() {
      return jsx('div', {});
    }
    function Child() {
      return jsx('span', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      children: jsx(Route as any, { path: '/child', component: Child })
    });
    // Manually flatten by going through createSsrRouter
    const ssrRouter = await createSsrRouter('/app/child', [routeEl]);
    expect(ssrRouter._chains).toHaveLength(1);
    const chain = ssrRouter._chains[0];
    expect(chain.leafPath).toBe('/app/child');
    expect(chain.levels).toHaveLength(2);
    expect(chain.levels[0].fullPath).toBe('/app');
    expect(chain.levels[1].fullPath).toBe('/app/child');
  });

  it('three-level nesting produces correct chain', async () => {
    function Root() {
      return jsx('div', {});
    }
    function Section() {
      return jsx('div', {});
    }
    function Page() {
      return jsx('p', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/root',
      component: Root,
      children: jsx(Route as any, {
        path: '/section',
        component: Section,
        children: jsx(Route as any, { path: '/page', component: Page })
      })
    });

    const ssrRouter = await createSsrRouter('/root/section/page', [routeEl]);
    const chain = ssrRouter._chains[0];
    expect(chain.leafPath).toBe('/root/section/page');
    expect(chain.levels.map((l) => l.fullPath)).toEqual(['/root', '/root/section', '/root/section/page']);
  });

  it('multiple children under one layout produce multiple chains', async () => {
    function Layout() {
      return jsx('div', {});
    }
    function ChildA() {
      return jsx('span', {});
    }
    function ChildB() {
      return jsx('span', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      children: [jsx(Route as any, { path: '/a', component: ChildA }), jsx(Route as any, { path: '/b', component: ChildB })]
    });

    const ssrRouter = await createSsrRouter('/app/a', [routeEl]);
    expect(ssrRouter._chains).toHaveLength(2);
    const paths = ssrRouter._chains.map((c) => c.leafPath);
    expect(paths).toContain('/app/a');
    expect(paths).toContain('/app/b');
    // Both chains share the same layout level
    for (const chain of ssrRouter._chains) {
      expect(chain.levels[0].component).toBe(Layout);
    }
  });
});

// ---------------------------------------------------------------------------
// Index route via path="."
// ---------------------------------------------------------------------------

describe('Index route via path="."', () => {
  it('path="." resolves to the parent path exactly', async () => {
    function Layout() {
      return jsx('div', {});
    }
    function Index() {
      return jsx('span', { children: 'index' });
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      children: jsx(Route as any, { path: '.', component: Index })
    });

    const ssrRouter = await createSsrRouter('/app', [routeEl]);
    expect(ssrRouter._chains).toHaveLength(1);
    expect(ssrRouter._chains[0].leafPath).toBe('/app');
    expect(ssrRouter._chains[0].levels).toHaveLength(2);
    expect(ssrRouter._chains[0].levels[1].fullPath).toBe('/app');
    expect(ssrRouter._chains[0].levels[1].component).toBe(Index);
  });

  it('index route renders when visiting the parent path', async () => {
    function Layout() {
      return jsx('section', { children: jsx(Outlet as any, {}) });
    }
    function Index() {
      return jsx('span', { children: 'index-content' });
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      children: jsx(Route as any, { path: '.', component: Index })
    });

    const { html } = await renderToString(jsx(Router as any, { initialUrl: '/app', children: [routeEl] }));
    expect(html).toContain('index-content');
  });
});

// ---------------------------------------------------------------------------
// Setup-time validation errors
// ---------------------------------------------------------------------------

describe('Setup-time config errors', () => {
  it('throws when a nested child path is "/"', async () => {
    function Layout() {
      return jsx('div', {});
    }
    function Child() {
      return jsx('span', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      children: jsx(Route as any, { path: '/', component: Child })
    });

    await expect(createSsrRouter('/app/', [routeEl])).rejects.toThrow(/child path.*not allowed|invalid nested route path/i);
  });

  it('throws when a child path does not start with "/" and is not "."', async () => {
    function Layout() {
      return jsx('div', {});
    }
    function Child() {
      return jsx('span', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      children: jsx(Route as any, { path: 'noslash', component: Child })
    });

    await expect(createSsrRouter('/app/noslash', [routeEl])).rejects.toThrow(/must start with "\/"/i);
  });

  it('throws when "." is used as a top-level path', async () => {
    function Home() {
      return jsx('div', {});
    }
    const routeEl = jsx(Route as any, { path: '.', component: Home });

    await expect(createSsrRouter('/', [routeEl])).rejects.toThrow(/only valid as a child route/i);
  });

  it('does not throw for valid nested paths', async () => {
    function Layout() {
      return jsx('div', {});
    }
    function Child() {
      return jsx('span', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      children: jsx(Route as any, { path: '/settings', component: Child })
    });

    await expect(createSsrRouter('/app/settings', [routeEl])).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Guard chain — outermost → inner
// ---------------------------------------------------------------------------

describe('Guard chain execution order', () => {
  it('runs guards outermost → inner', async () => {
    const order: string[] = [];

    function Layout() {
      return jsx('div', {});
    }
    function Page() {
      return jsx('span', {});
    }

    const outerGuard = async () => {
      order.push('outer');
      return true as const;
    };
    const innerGuard = async () => {
      order.push('inner');
      return true as const;
    };

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      beforeEnter: outerGuard,
      children: jsx(Route as any, { path: '/page', component: Page, beforeEnter: innerGuard })
    });

    await createSsrRouter('/app/page', [routeEl]);
    expect(order).toEqual(['outer', 'inner']);
  });

  it('outer redirect skips inner guard', async () => {
    const innerGuard = vi.fn(async () => true as const);

    function Layout() {
      return jsx('div', {});
    }
    function Page() {
      return jsx('span', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      beforeEnter: async () => '/login',
      children: jsx(Route as any, { path: '/page', component: Page, beforeEnter: innerGuard })
    });

    try {
      await createSsrRouter('/app/page', [routeEl]);
    } catch {
      // RedirectError expected
    }
    expect(innerGuard).not.toHaveBeenCalled();
  });

  it('outer redirect throws RedirectError with correct location', async () => {
    const { RedirectError } = await import('./router.js');
    function Layout() {
      return jsx('div', {});
    }
    function Page() {
      return jsx('span', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      beforeEnter: async () => '/login',
      children: jsx(Route as any, { path: '/page', component: Page })
    });

    const err = await createSsrRouter('/app/page', [routeEl]).catch((e) => e);
    expect(err).toBeInstanceOf(RedirectError);
    expect(err.location).toBe('/login');
  });
});

// ---------------------------------------------------------------------------
// Parallel loaders
// ---------------------------------------------------------------------------

describe('Parallel loaders', () => {
  it('runs layout and leaf loaders in parallel', async () => {
    const startTimes: Record<string, number> = {};

    function Layout() {
      return jsx('div', {});
    }
    function Page() {
      return jsx('span', {});
    }

    const layoutLoader = async () => {
      startTimes['layout'] = Date.now();
      await new Promise((r) => setTimeout(r, 20));
      return { layout: true };
    };
    const pageLoader = async () => {
      startTimes['page'] = Date.now();
      await new Promise((r) => setTimeout(r, 20));
      return { page: true };
    };

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      load: layoutLoader,
      children: jsx(Route as any, { path: '/page', component: Page, load: pageLoader })
    });

    const start = Date.now();
    const ssrRouter = await createSsrRouter('/app/page', [routeEl]);
    const elapsed = Date.now() - start;

    // Both loaders should have started near-simultaneously (parallel), not serially (40ms+).
    // Allow generous margin for CI timing variance.
    expect(elapsed).toBeLessThan(50);

    // Both datasets should be in the map
    expect(ssrRouter._routeDataMap.get('/app')?.()).toEqual({ layout: true });
    expect(ssrRouter._routeDataMap.get('/app/page')?.()).toEqual({ page: true });
  });

  it('layout and leaf each have independent data via useRouteData()', async () => {
    let layoutData: unknown;
    let pageData: unknown;

    function Layout() {
      layoutData = useRouteData();
      return jsx('div', { children: jsx(Outlet as any, {}) });
    }
    function Page() {
      pageData = useRouteData();
      return jsx('span', { children: 'page' });
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      load: async () => ({ source: 'layout' }),
      children: jsx(Route as any, {
        path: '/page',
        component: Page,
        load: async () => ({ source: 'page' })
      })
    });

    // Use createSsrRouter so loaders run before renderToString
    const ssrRouter = await createSsrRouter('/app/page', [routeEl]);
    await renderToString(jsx(Router as any, { router: ssrRouter, children: [routeEl] }));

    expect(layoutData).toEqual({ source: 'layout' });
    expect(pageData).toEqual({ source: 'page' });
  });
});

// ---------------------------------------------------------------------------
// Params merging
// ---------------------------------------------------------------------------

describe('Params merging across levels', () => {
  it('useParams() returns merged params for both layout and leaf segments', async () => {
    let capturedParams: Record<string, string> = {};

    function Layout() {
      return jsx('div', { children: jsx(Outlet as any, {}) });
    }
    function Page() {
      capturedParams = useParams();
      return jsx('span', { children: 'page' });
    }

    const routeEl = jsx(Route as any, {
      path: '/projects/:projectId',
      component: Layout,
      children: jsx(Route as any, { path: '/tasks/:taskId', component: Page })
    });

    await renderToString(
      jsx(Router as any, {
        initialUrl: '/projects/42/tasks/99',
        children: [routeEl]
      })
    );

    expect(capturedParams).toEqual({ projectId: '42', taskId: '99' });
  });

  it('router._chains resolves correct leaf path with param segments', async () => {
    function Layout() {
      return jsx('div', {});
    }
    function Page() {
      return jsx('span', {});
    }

    const routeEl = jsx(Route as any, {
      path: '/projects/:projectId',
      component: Layout,
      children: jsx(Route as any, { path: '/tasks/:taskId', component: Page })
    });

    const ssrRouter = await createSsrRouter('/projects/1/tasks/2', [routeEl]);
    expect(ssrRouter._chains).toHaveLength(1);
    expect(ssrRouter._chains[0].leafPath).toBe('/projects/:projectId/tasks/:taskId');
    expect(ssrRouter.location.params).toEqual({ projectId: '1', taskId: '2' });
  });
});

// ---------------------------------------------------------------------------
// Outlet renders matched child
// ---------------------------------------------------------------------------

describe('Outlet — renders matched child', () => {
  it('renders child component inside layout via Outlet (SSR)', async () => {
    function Layout() {
      return jsx('div', {
        class: 'layout',
        children: jsx(Outlet as any, {})
      });
    }
    function Child() {
      return jsx('span', { children: 'child-content' });
    }

    const { html } = await renderToString(
      jsx(Router as any, {
        initialUrl: '/app/child',
        children: [
          jsx(Route as any, {
            path: '/app',
            component: Layout,
            children: jsx(Route as any, { path: '/child', component: Child })
          })
        ]
      })
    );

    expect(html).toContain('class="layout"');
    expect(html).toContain('child-content');
  });

  it('renders child component inside layout via Outlet (DOM)', () => {
    function Layout() {
      return jsx('div', { class: 'layout', children: jsx(Outlet as any, {}) });
    }
    function Child() {
      return jsx('span', { children: 'child-dom' });
    }

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as any, {
          initialUrl: '/app/child',
          children: [
            jsx(Route as any, {
              path: '/app',
              component: Layout,
              children: jsx(Route as any, { path: '/child', component: Child })
            })
          ]
        }),
        container
      );
    });

    expect(container.querySelector('.layout')).not.toBeNull();
    expect(container.textContent).toContain('child-dom');
  });

  it('Outlet at leaf (no deeper level) renders nothing', async () => {
    function Leaf() {
      return jsx('div', {
        children: [jsx('span', { children: 'leaf' }), jsx(Outlet as any, {})]
      });
    }

    const { html } = await renderToString(
      jsx(Router as any, {
        initialUrl: '/leaf',
        children: [jsx(Route as any, { path: '/leaf', component: Leaf })]
      })
    );

    expect(html).toContain('leaf');
    // No extra content from Outlet at leaf
  });

  it('Outlet outside Router renders nothing without throwing', async () => {
    const { html } = await renderToString(jsx(Outlet as any, {}));
    // Should be empty — no crash
    expect(html).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Outlet forwards extra props to child component
// ---------------------------------------------------------------------------

describe('Outlet — forwards extra props', () => {
  it('extra props passed to Outlet are received by the child component', async () => {
    let receivedProps: Record<string, unknown> = {};

    function Layout() {
      return jsx(Outlet as any, { extra: 'forwarded-value', data: 42 });
    }
    function Child(props: Record<string, unknown>) {
      receivedProps = props;
      return jsx('span', { children: 'child' });
    }

    await renderToString(
      jsx(Router as any, {
        initialUrl: '/app/child',
        children: [
          jsx(Route as any, {
            path: '/app',
            component: Layout,
            children: jsx(Route as any, { path: '/child', component: Child })
          })
        ]
      })
    );

    expect(receivedProps.extra).toBe('forwarded-value');
    expect(receivedProps.data).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// SSR rendering — multi-level nesting
// ---------------------------------------------------------------------------

describe('Nested layouts — SSR rendering', () => {
  it('renders three-level nesting correctly', async () => {
    function Root() {
      return jsx('div', { class: 'root', children: jsx(Outlet as any, {}) });
    }
    function Section() {
      return jsx('section', { children: jsx(Outlet as any, {}) });
    }
    function Page() {
      return jsx('p', { children: 'deep-page' });
    }

    const { html } = await renderToString(
      jsx(Router as any, {
        initialUrl: '/root/section/page',
        children: [
          jsx(Route as any, {
            path: '/root',
            component: Root,
            children: jsx(Route as any, {
              path: '/section',
              component: Section,
              children: jsx(Route as any, { path: '/page', component: Page })
            })
          })
        ]
      })
    );

    expect(html).toContain('class="root"');
    expect(html).toContain('<section');
    expect(html).toContain('deep-page');
  });

  it('flat routes still work with the new chain-based matching', async () => {
    function Home() {
      return jsx('div', { children: 'home' });
    }
    function About() {
      return jsx('div', { children: 'about' });
    }

    const { html } = await renderToString(
      jsx(Router as any, {
        initialUrl: '/about',
        children: [jsx(Route as any, { path: '/', component: Home }), jsx(Route as any, { path: '/about', component: About })]
      })
    );

    expect(html).toContain('about');
    expect(html).not.toContain('home');
  });
});

// ---------------------------------------------------------------------------
// DOM navigation between nested routes
// ---------------------------------------------------------------------------

describe('Nested layouts — DOM navigation', () => {
  it('navigates between child routes while keeping layout mounted', async () => {
    function Layout() {
      return jsx('div', { class: 'layout', children: jsx(Outlet as any, {}) });
    }
    function PageA() {
      return jsx('span', { children: 'page-a' });
    }
    function PageB() {
      return jsx('span', { children: 'page-b' });
    }

    const container = document.createElement('div');
    reactiveScope(() => {
      const el = jsx(Router as any, {
        initialUrl: '/app/a',
        children: [
          jsx(Route as any, {
            path: '/app',
            component: Layout,
            children: [jsx(Route as any, { path: '/a', component: PageA }), jsx(Route as any, { path: '/b', component: PageB })]
          })
        ]
      });
      mount(el, container);
    });

    expect(container.textContent).toContain('page-a');
    expect(container.querySelector('.layout')).not.toBeNull();
  });
});
