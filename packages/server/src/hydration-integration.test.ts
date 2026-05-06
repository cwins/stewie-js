// @vitest-environment happy-dom
/**
 * Hydration integration tests — SSR → hydrate round-trip.
 *
 * Each test exercises the full pipeline:
 *   renderToString() → inject HTML + __STEWIE_STATE__ → hydrate()
 *
 * These tests describe the *observable contract* of hydration from the outside.
 * They currently pass because hydrate() remounts and produces the correct
 * end-state. Once true DOM-reuse hydration is implemented, additional
 * assertions (MutationObserver counts, node identity) will be layered on top.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx, signal, computed, reactiveScope, Show, For, Suspense, defineResource, useResource } from '@stewie-js/core';
import type { JSXElement, Resource } from '@stewie-js/core';
import { hydrate } from '@stewie-js/core';
import { renderToString } from './stream.js';
import { useHydrationRegistry } from './hydration.js';
import { Router, Route, Outlet, createSsrRouter } from '@stewie-js/router';
import { useRouteData } from '@stewie-js/router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse window.__STEWIE_STATE__ JSON out of the emitted stateScript tag. */
function extractState(stateScript: string): Record<string, unknown> {
  const match = stateScript.match(/window\.__STEWIE_STATE__\s*=\s*(\{[\s\S]*?\});window\.__STEWIE_DATA__/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

/** Parse window.__STEWIE_DATA__ JSON out of the emitted stateScript tag. */
function extractData(stateScript: string): Record<string, unknown> {
  const match = stateScript.match(/window\.__STEWIE_DATA__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

/**
 * Full SSR → hydrate round-trip helper.
 *
 * Renders `factory()` to a string, injects the HTML into `container`,
 * sets window.__STEWIE_STATE__, then calls hydrate() with a fresh element
 * from `factory()`. Returns the dispose function from hydrate().
 */
async function ssrThenHydrate(factory: () => JSXElement, container: HTMLElement): Promise<() => void> {
  const { html, stateScript } = await renderToString(factory());
  container.innerHTML = html;
  window.__STEWIE_STATE__ = extractState(stateScript);
  window.__STEWIE_DATA__ = extractData(stateScript);
  let dispose!: () => void;
  reactiveScope(() => {
    dispose = hydrate(factory(), container);
  });
  return dispose;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  delete window.__STEWIE_STATE__;
  delete window.__STEWIE_DATA__;
});
afterEach(() => {
  delete window.__STEWIE_STATE__;
  delete window.__STEWIE_DATA__;
});

// ---------------------------------------------------------------------------
// Basic round-trip
// ---------------------------------------------------------------------------

describe('SSR → hydrate: basic round-trip', () => {
  it('produces correct DOM structure after hydration', async () => {
    const container = document.createElement('div');
    await ssrThenHydrate(
      () =>
        jsx('div', {
          children: [jsx('h1', { children: 'Hello' }), jsx('p', { children: 'World' })]
        }),
      container
    );
    expect(container.querySelector('h1')?.textContent).toBe('Hello');
    expect(container.querySelector('p')?.textContent).toBe('World');
  });

  it('hydrates without throwing when __STEWIE_STATE__ is absent', async () => {
    const container = document.createElement('div');
    const { html } = await renderToString(jsx('p', { children: 'hello' }));
    container.innerHTML = html;
    // Deliberately do not set window.__STEWIE_STATE__
    expect(() => {
      reactiveScope(() => {
        hydrate(jsx('p', { children: 'hello' }), container);
      });
    }).not.toThrow();
    expect(container.querySelector('p')?.textContent).toBe('hello');
  });

  it('hydrates cleanly into an empty container (fresh client mount, no SSR)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    reactiveScope(() => {
      hydrate(jsx('div', { children: 'fresh' }), container);
    });
    expect(container.textContent).toBe('fresh');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('dispose() cleans up after hydration', async () => {
    const container = document.createElement('div');
    const dispose = await ssrThenHydrate(() => jsx('p', { children: 'test' }), container);
    expect(container.textContent).toBe('test');
    dispose();
    expect(container.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Hydration state transfer (__STEWIE_STATE__)
// ---------------------------------------------------------------------------

describe('SSR → hydrate: state transfer', () => {
  it('transfers server-set registry values to the client', async () => {
    function StatefulComp(): JSXElement {
      const registry = useHydrationRegistry();
      // Server: writes the value. Client: reads it back via __STEWIE_STATE__.
      if (registry && registry.get('greeting') === undefined) {
        registry.set('greeting', 'hello from server');
      }
      return jsx('div', { children: String(registry?.get('greeting') ?? '') });
    }

    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx(StatefulComp as any, {}), container);
    expect(container.querySelector('div')?.textContent).toBe('hello from server');
  });

  it('stateScript contains __STEWIE_STATE__ outside the HTML fragment', async () => {
    const { html, stateScript } = await renderToString(jsx('div', { children: 'ok' }));
    // State must be in the script tag, not embedded in the HTML fragment
    expect(html).not.toContain('__STEWIE_STATE__');
    expect(stateScript).toContain('window.__STEWIE_STATE__');
  });

  it('multiple registry keys survive the round-trip', async () => {
    function MultiState(): JSXElement {
      const registry = useHydrationRegistry();
      if (registry) {
        if (registry.get('a') === undefined) registry.set('a', 1);
        if (registry.get('b') === undefined) registry.set('b', 2);
      }
      const a = (registry?.get('a') as number) ?? 0;
      const b = (registry?.get('b') as number) ?? 0;
      return jsx('div', { children: String(a + b) });
    }

    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx(MultiState as any, {}), container);
    expect(container.querySelector('div')?.textContent).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// Reactive updates after hydration
// ---------------------------------------------------------------------------

describe('SSR → hydrate: reactive updates', () => {
  it('signal updates reflect in the DOM after hydration', async () => {
    let sig!: ReturnType<typeof signal<number>>;

    function Counter(): JSXElement {
      reactiveScope(() => {
        sig = signal(0);
      });
      return jsx('span', { children: sig });
    }

    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx(Counter as any, {}), container);

    expect(container.querySelector('span')?.textContent).toBe('0');
    sig.set(42);
    expect(container.querySelector('span')?.textContent).toBe('42');
  });

  it('computed value updates in the DOM after hydration', async () => {
    let count!: ReturnType<typeof signal<number>>;
    let doubled!: ReturnType<typeof computed<number>>;

    function DoubleCounter(): JSXElement {
      reactiveScope(() => {
        count = signal(3);
        doubled = computed(() => count() * 2);
      });
      return jsx('span', { children: doubled });
    }

    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx(DoubleCounter as any, {}), container);
    expect(container.querySelector('span')?.textContent).toBe('6');
    count.set(5);
    expect(container.querySelector('span')?.textContent).toBe('10');
  });

  it('event handlers fire correctly after hydration', async () => {
    let clicked = false;

    function ClickTarget(): JSXElement {
      return jsx('button', {
        onClick: () => {
          clicked = true;
        },
        children: 'click me'
      });
    }

    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx(ClickTarget as any, {}), container);

    container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicked).toBe(true);
  });

  it('reactive class attribute updates after hydration', async () => {
    let active!: ReturnType<typeof signal<boolean>>;

    function Toggler(): JSXElement {
      reactiveScope(() => {
        active = signal(false);
      });
      return jsx('div', { class: () => (active() ? 'on' : 'off') });
    }

    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx(Toggler as any, {}), container);

    expect(container.querySelector('div')?.className).toBe('off');
    active.set(true);
    expect(container.querySelector('div')?.className).toBe('on');
  });
});

// ---------------------------------------------------------------------------
// Control flow hydration
// ---------------------------------------------------------------------------

describe('SSR → hydrate: control flow', () => {
  it('Show: renders the truthy branch after hydration', async () => {
    const container = document.createElement('div');
    await ssrThenHydrate(
      () =>
        jsx('div', {
          children: Show({ when: true, children: jsx('span', { children: 'shown' }) })
        }),
      container
    );
    expect(container.querySelector('span')?.textContent).toBe('shown');
  });

  it('Show: renders fallback branch after hydration', async () => {
    const container = document.createElement('div');
    await ssrThenHydrate(
      () =>
        jsx('div', {
          children: Show({
            when: false,
            children: jsx('span', { children: 'hidden' }),
            fallback: jsx('span', { children: 'fallback' })
          })
        }),
      container
    );
    expect(container.textContent).toContain('fallback');
    expect(container.textContent).not.toContain('hidden');
  });

  it('Show: toggles correctly when signal changes after hydration', async () => {
    let visible!: ReturnType<typeof signal<boolean>>;

    function Conditional(): JSXElement {
      reactiveScope(() => {
        visible = signal(true);
      });
      return jsx('div', {
        children: Show({ when: visible, children: jsx('span', { children: 'yes' }) })
      });
    }

    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx(Conditional as any, {}), container);

    expect(container.querySelector('span')?.textContent).toBe('yes');
    visible.set(false);
    expect(container.querySelector('span')).toBeNull();
    visible.set(true);
    expect(container.querySelector('span')?.textContent).toBe('yes');
  });

  it('For: renders list items after hydration', async () => {
    const container = document.createElement('div');
    await ssrThenHydrate(
      () =>
        jsx('ul', {
          children: For({
            each: ['alpha', 'beta', 'gamma'],
            children: (item: () => string) => jsx('li', { children: item() })
          })
        }),
      container
    );
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('alpha');
    expect(items[1].textContent).toBe('beta');
    expect(items[2].textContent).toBe('gamma');
  });

  it('For: list updates after hydration when signal changes', async () => {
    let items!: ReturnType<typeof signal<string[]>>;

    function ReactiveList(): JSXElement {
      reactiveScope(() => {
        items = signal(['a', 'b']);
      });
      return jsx('ul', {
        children: For({
          each: items,
          children: (item: () => string) => jsx('li', { children: item })
        })
      });
    }

    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx(ReactiveList as any, {}), container);

    expect(container.querySelectorAll('li')).toHaveLength(2);
    items.set(['a', 'b', 'c']);
    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(container.querySelectorAll('li')[2].textContent).toBe('c');
  });
});

// ---------------------------------------------------------------------------
// Mismatch detection
// ---------------------------------------------------------------------------

describe('SSR → hydrate: mismatch detection', () => {
  it('warns in dev when client output differs from server HTML', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');

    // Inject server HTML manually with different content than what the client renders
    container.innerHTML = '<p>server text</p>';
    reactiveScope(() => {
      hydrate(jsx('p', { children: 'client text' }), container);
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[stewie] Hydration mismatch'),
      expect.anything(),
      expect.stringContaining('server text')
    );
    warnSpy.mockRestore();
  });

  it('does not warn when server and client output match', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container = document.createElement('div');
    await ssrThenHydrate(() => jsx('p', { children: 'consistent' }), container);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// SSR → hydrate: Suspense + DataRegistry replay
// ---------------------------------------------------------------------------

describe('SSR → hydrate: Suspense + DataRegistry', () => {
  it('useResource data resolved on server is replayed without refetch on hydration', async () => {
    let serverFetchCount = 0;
    let clientFetchCount = 0;
    let phase: 'server' | 'client' = 'server';

    const fetchUser = defineResource(
      (id: number) => {
        if (phase === 'server') {
          serverFetchCount++;
          return Promise.resolve({ id, name: `User ${id}` });
        }
        clientFetchCount++;
        return Promise.resolve({ id, name: 'CLIENT' });
      },
      { id: 'fetchUserHydrationTest' }
    );

    function UserView(): JSXElement {
      // Resource created outside the inner component so the Suspense retry on
      // server reuses the same instance — the standard SSR pattern.
      let res!: Resource<{ id: number; name: string }>;
      reactiveScope(() => {
        res = useResource(fetchUser, () => 7);
      });
      function Inner() {
        const data = res.read();
        return jsx('span', { children: data.name });
      }
      return jsx(
        Suspense as unknown as () => JSXElement,
        {
          fallback: jsx('span', { children: 'Loading...' }),
          children: jsx(Inner, {})
        } as unknown as Record<string, unknown>
      );
    }

    // Server render — should fetch once, place data in __STEWIE_DATA__
    const { html, stateScript } = await renderToString(jsx(UserView, {}));
    expect(serverFetchCount).toBe(1);
    expect(html).toContain('User 7');
    expect(html).not.toContain('Loading...');

    const data = extractData(stateScript);
    // The DataRegistry serialized at least one entry under fetchUserHydrationTest.
    const keys = Object.keys(data);
    expect(keys.some((k) => k.startsWith('fetchUserHydrationTest:'))).toBe(true);

    // Switch to client phase and hydrate. If the registry replay worked, the
    // client fetcher must NOT run, the fallback must NOT flash in.
    phase = 'client';
    const container = document.createElement('div');
    container.innerHTML = html;
    window.__STEWIE_STATE__ = extractState(stateScript);
    window.__STEWIE_DATA__ = data;

    reactiveScope(() => {
      hydrate(jsx(UserView, {}), container);
    });

    expect(clientFetchCount).toBe(0);
    expect(container.textContent).toContain('User 7');
    expect(container.textContent).not.toContain('CLIENT');
    expect(container.textContent).not.toContain('Loading...');
  });

  it('streaming-mode unresolved boundary: hydrate defers until the swap fires, then claims post-swap nodes without refetching', async () => {
    let clientFetchCount = 0;

    const fetchUser = defineResource(
      (id: number) => {
        clientFetchCount++;
        return Promise.resolve({ id, name: 'CLIENT_REFETCH' });
      },
      { id: 'streamingPlaceholderTest' }
    );

    function Inner(): JSXElement {
      let res!: Resource<{ id: number; name: string }>;
      reactiveScope(() => {
        res = useResource(fetchUser, () => 9);
      });
      const data = res.read();
      return jsx('span', { children: data.name });
    }
    function UserView(): JSXElement {
      return jsx(
        Suspense as unknown as () => JSXElement,
        {
          fallback: jsx('span', { children: 'Loading...' }),
          children: jsx(Inner, {})
        } as unknown as Record<string, unknown>
      );
    }

    // Simulate streaming SSR: container starts with placeholder div + Suspense
    // anchor, registry has nothing yet for this resource.
    const container = document.createElement('div');
    container.innerHTML = '<div id="__ss0"><span>Loading...</span></div><!--Suspense-->';
    window.__STEWIE_STATE__ = {};
    window.__STEWIE_DATA__ = {};

    reactiveScope(() => {
      hydrate(jsx(UserView, {}), container);
    });

    // Hydration should not have refetched — boundary is deferred.
    expect(clientFetchCount).toBe(0);
    // Fallback DOM still present.
    expect(container.textContent).toContain('Loading...');

    // Simulate the swap script + inline data patch landing.
    window.__STEWIE_DATA__ = {
      'streamingPlaceholderTest:9': { id: 9, name: 'STREAMED' }
    };
    const placeholder = container.querySelector('#__ss0')!;
    const resolved = document.createElement('span');
    resolved.textContent = 'STREAMED';
    placeholder.replaceWith(resolved);

    // Let the MutationObserver microtask fire.
    await Promise.resolve();
    await Promise.resolve();

    expect(clientFetchCount).toBe(0);
    expect(container.textContent).toContain('STREAMED');
    expect(container.textContent).not.toContain('Loading...');
  });
});

// ---------------------------------------------------------------------------
// SSR → hydrate: nested layout routes
// ---------------------------------------------------------------------------

describe('SSR → hydrate: nested layout routes', () => {
  it('SSR round-trip with layout + leaf renders correct HTML and hydrates cleanly', async () => {
    function Layout(): JSXElement {
      return jsx('div', { class: 'layout', children: jsx(Outlet as any, {}) });
    }
    function Page(): JSXElement {
      return jsx('span', { children: 'page-content' });
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      children: jsx(Route as any, { path: '/page', component: Page })
    });

    const ssrRouter = await createSsrRouter('/app/page', [routeEl]);
    const { html } = await renderToString(jsx(Router as any, { router: ssrRouter, children: [routeEl] }));

    // SSR output should contain both layout and leaf content
    expect(html).toContain('class="layout"');
    expect(html).toContain('page-content');

    // Hydration should not throw and should produce correct DOM
    const container = document.createElement('div');
    container.innerHTML = html;
    window.__STEWIE_STATE__ = {};
    window.__STEWIE_DATA__ = {};

    expect(() => {
      reactiveScope(() => {
        hydrate(jsx(Router as any, { router: ssrRouter, children: [routeEl] }), container);
      });
    }).not.toThrow();

    expect(container.querySelector('.layout')).not.toBeNull();
    expect(container.textContent).toContain('page-content');

    delete window.__STEWIE_STATE__;
    delete window.__STEWIE_DATA__;
  });

  it('SSR round-trip with per-level loaders serializes both data entries', async () => {
    let layoutData: unknown;
    let pageData: unknown;

    function Layout(): JSXElement {
      layoutData = useRouteData();
      return jsx('div', { class: 'layout', children: jsx(Outlet as any, {}) });
    }
    function Page(): JSXElement {
      pageData = useRouteData();
      return jsx('span', { children: 'ok' });
    }

    const routeEl = jsx(Route as any, {
      path: '/app',
      component: Layout,
      load: async () => ({ level: 'layout' }),
      children: jsx(Route as any, {
        path: '/page',
        component: Page,
        load: async () => ({ level: 'page' })
      })
    });

    const ssrRouter = await createSsrRouter('/app/page', [routeEl]);
    const { stateScript } = await renderToString(jsx(Router as any, { router: ssrRouter, children: [routeEl] }));

    // Both levels' data should be serialized
    expect(stateScript).toContain('"__stewie_route_data__:/app"');
    expect(stateScript).toContain('"__stewie_route_data__:/app/page"');
    expect(layoutData).toEqual({ level: 'layout' });
    expect(pageData).toEqual({ level: 'page' });
  });
});
