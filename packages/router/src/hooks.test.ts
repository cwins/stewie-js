// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { computed, jsx, mount, provide, reactiveScope } from '@stewie-js/core';
import { createRouter, RouterContext, useRouter } from './router.js';
import { Route, Router } from './components.js';
import { useParams, useQuery } from './hooks.js';

/**
 * `location.query` and `location.params` are replaced wholesale on navigation,
 * and the store notifies only the exact path written (`query`), never its
 * descendants (`query.id`). A consumer that captured the object at setup —
 * which is what every component does, since `useQuery()` is called once in the
 * component body — would therefore read stale values forever.
 *
 * The bug was masked until query-only navigations stopped re-mounting the
 * route: before that, every navigation re-created the component, so the
 * captured object was always fresh.
 */
describe('useQuery / useParams are live views, not snapshots', () => {
  it('useQuery() captured at setup reflects a later navigation', async () => {
    const router = createRouter('/characters');

    let read: () => string | undefined = () => undefined;
    provide(RouterContext, router, () => {
      reactiveScope(() => {
        const q = useQuery<{ id?: string }>();
        read = computed(() => q.id);
      });
    });

    expect(read()).toBeUndefined();

    await router.navigate('/character?id=5');
    expect(read()).toBe('5');

    // Query-only navigation: the route does not re-mount, so this only works
    // if the captured view re-resolves.
    await router.navigate('/character?id=9');
    expect(read()).toBe('9');
  });

  it('useParams() captured at setup reflects a later navigation', async () => {
    let read: () => string | undefined = () => undefined;
    let navigate: ((url: string) => Promise<void>) | null = null;

    function Page() {
      const router = useRouter();
      navigate = (url: string) => router.navigate(url) as Promise<void>;
      const p = useParams<{ userId: string }>();
      read = computed(() => p.userId);
      return jsx('span', { children: () => `user ${read()}` });
    }

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/users/1',
          children: [jsx(Route as never, { path: '/users/:userId', component: Page })]
        }),
        container
      );
    });

    expect(read()).toBe('1');

    await navigate!('/users/2');
    expect(read()).toBe('2');
  });

  it('setQuery() is visible to a captured useQuery()', () => {
    const router = createRouter('/search?q=cats');

    let read: () => string | undefined = () => undefined;
    provide(RouterContext, router, () => {
      reactiveScope(() => {
        const q = useQuery<{ q?: string; page?: string }>();
        read = computed(() => q.q);
      });
    });

    expect(read()).toBe('cats');
    router.setQuery({ q: 'dogs' });
    expect(read()).toBe('dogs');
  });

  it('the view still behaves like a plain object for spread and Object.keys', () => {
    const router = createRouter('/c?a=1&b=2');

    provide(RouterContext, router, () => {
      const q = useQuery() as Record<string, string>;
      expect({ ...q }).toEqual({ a: '1', b: '2' });
      expect(Object.keys(q).sort()).toEqual(['a', 'b']);
      expect('a' in q).toBe(true);
      expect('zz' in q).toBe(false);
      expect(q).toEqual({ a: '1', b: '2' });
    });
  });

  it('renders the query-driven branch after a client-side navigation', async () => {
    // The reported symptom: navigating to ?id=… rendered the "no character
    // selected" fallback until a full reload.
    let navigate: ((url: string) => Promise<void>) | null = null;

    function List() {
      const router = useRouter();
      navigate = (url: string) => router.navigate(url) as Promise<void>;
      return jsx('span', { children: 'list' });
    }

    function Detail() {
      const q = useQuery<{ id?: string }>();
      const id = computed(() => q.id ?? '');
      return jsx('span', { children: () => (id() ? `character ${id()}` : 'no character selected') });
    }

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/characters',
          children: [
            jsx(Route as never, { path: '/characters', component: List }),
            jsx(Route as never, { path: '/character', component: Detail })
          ]
        }),
        container
      );
    });

    expect(container.textContent).toContain('list');

    await navigate!('/character?id=5');
    expect(container.textContent).toContain('character 5');
    expect(container.textContent).not.toContain('no character selected');

    // Query-only move between two detail views — no re-mount happens here.
    await navigate!('/character?id=9');
    expect(container.textContent).toContain('character 9');
  });
});
