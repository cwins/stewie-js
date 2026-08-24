// @vitest-environment happy-dom
/**
 * Reproduction: navigating away from a param route must not re-run the
 * outgoing component's param-derived computeds with the incoming route's
 * params.
 */
import { describe, expect, it } from 'vitest';
import { computed, jsx, mount, reactiveScope } from '@stewie-js/core';
import { Route, Router } from './components.js';
import { useParams, useRouter } from './index.js';

describe('route param invalidation vs. subtree disposal', () => {
  it('does not re-run an outgoing route computed with the new route params', async () => {
    const seen: (string | undefined)[] = [];
    let navigate: ((url: string) => Promise<void>) | null = null;

    function DetailPage() {
      const params = useParams<{ slug: string }>();
      const slug = computed(() => {
        seen.push(params.slug);
        return params.slug;
      });
      return jsx('span', { children: () => `detail ${slug()}` });
    }

    function DiscoverPage() {
      const router = useRouter();
      navigate = (url: string) => router.navigate(url) as Promise<void>;
      return jsx('span', { children: 'discover' });
    }

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/discover',
          children: [
            jsx(Route as never, { path: '/discover', component: DiscoverPage }),
            jsx(Route as never, { path: '/detail/:slug', component: DetailPage })
          ]
        }),
        container
      );
    });

    await navigate!('/detail/charizard');
    expect(container.textContent).toContain('detail charizard');
    expect(seen).toEqual(['charizard']);

    // Leaving the param route: DetailPage is being disposed. Its computed must
    // not observe the paramless route's `{}`.
    await navigate!('/discover');

    expect(container.textContent).toContain('discover');
    expect(seen).toEqual(['charizard']);
  });

  it('an error thrown while leaving a route does not strand the DOM', async () => {
    let navigate: ((url: string) => Promise<void>) | null = null;

    function CrashOnExit() {
      const params = useParams<{ slug: string }>();
      // Mirrors the demo app: a non-defensive helper that throws the moment
      // the param goes missing.
      const label = computed(() => params.slug.toUpperCase());
      return jsx('span', { children: () => `detail ${label()}` });
    }

    function DiscoverPage() {
      const router = useRouter();
      navigate = (url: string) => router.navigate(url) as Promise<void>;
      return jsx('span', { children: 'discover' });
    }

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/discover',
          children: [
            jsx(Route as never, { path: '/discover', component: DiscoverPage }),
            jsx(Route as never, { path: '/detail/:slug', component: CrashOnExit })
          ]
        }),
        container
      );
    });

    await navigate!('/detail/charizard');
    expect(container.textContent).toContain('detail CHARIZARD');

    await navigate!('/discover');
    expect(container.textContent).toContain('discover');
  });
});
