// @vitest-environment happy-dom
/**
 * STW076 — reading a param key the matched route does not declare.
 *
 * `useParams<{ slug: string }>()` types every key as present, but nothing
 * checks the annotation against the route's path. Reading a key the route
 * never declares yields `undefined` under a `string` type, which then flows
 * into app code as a non-nullable value — the shape that crashed an external
 * demo app (`params.pokemon.split(...)`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsx, mount, reactiveScope } from '@stewie-js/core';
import { Route, Router } from './components.js';
import { useParams } from './index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function mountAt(url: string, path: string, read: (p: Record<string, string>) => void): void {
  function Page() {
    read(useParams() as Record<string, string>);
    return jsx('span', { children: 'page' });
  }
  const container = document.createElement('div');
  reactiveScope(() => {
    mount(jsx(Router as never, { initialUrl: url, children: [jsx(Route as never, { path, component: Page })] }), container);
  });
}

describe('STW076 — unknown route param', () => {
  it('warns when reading a key the matched route does not declare', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mountAt('/detail/charizard', '/detail/:slug', (params) => {
      void params.pokemon; // route declares :slug, not :pokemon
    });

    expect(warn).toHaveBeenCalledTimes(1);
    const message = warn.mock.calls[0][0] as string;
    expect(message).toContain('STW076');
    expect(message).toContain('pokemon');
    expect(message).toContain('/detail/:slug');
  });

  it('does not warn for a declared key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mountAt('/detail/charizard', '/detail/:slug', (params) => {
      expect(params.slug).toBe('charizard');
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn for existence checks or enumeration', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mountAt('/detail/charizard', '/detail/:slug', (params) => {
      expect('pokemon' in params).toBe(false);
      expect(Object.keys(params)).toEqual(['slug']);
      expect({ ...params }).toEqual({ slug: 'charizard' });
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once per key, not once per read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mountAt('/detail/charizard', '/detail/:slug', (params) => {
      void params.pokemon;
      void params.pokemon;
      void params.pokemon;
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
