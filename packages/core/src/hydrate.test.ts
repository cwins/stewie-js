// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from './jsx-runtime.js';
import { createRoot } from './reactive.js';
import { inject } from './context.js';
import { useHydrationRegistry, HydrationRegistryContext } from './hydration.js';
import { hydrate } from './hydrate.js';
import { provide } from './context.js';

function container(): HTMLDivElement {
  return document.createElement('div');
}

// ---------------------------------------------------------------------------
// useHydrationRegistry
// ---------------------------------------------------------------------------

describe('useHydrationRegistry', () => {
  it('returns null when no registry is provided', () => {
    const result = inject(HydrationRegistryContext);
    expect(result).toBeNull();
  });

  it('returns the registry inside provide()', () => {
    let registry = null;
    provide(HydrationRegistryContext, { get: () => 42, set: () => {}, serialize: () => '' }, () => {
      registry = useHydrationRegistry();
    });
    expect(registry).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hydrate — reads window.__STEWIE_STATE__
// ---------------------------------------------------------------------------

describe('hydrate', () => {
  beforeEach(() => {
    delete window.__STEWIE_STATE__;
  });
  afterEach(() => {
    delete window.__STEWIE_STATE__;
  });

  it('mounts the app into the container', () => {
    const c = container();
    hydrate(jsx('p', { children: 'hello' }), c);
    expect(c.textContent).toBe('hello');
  });

  it('provides registry to components when __STEWIE_STATE__ is set', () => {
    window.__STEWIE_STATE__ = { greeting: 'hi from server' };

    let capturedValue: unknown = undefined;
    function App() {
      const registry = useHydrationRegistry();
      capturedValue = registry?.get('greeting');
      return jsx('div', {});
    }

    const c = container();
    createRoot(() => {
      hydrate(jsx(App as unknown as () => ReturnType<typeof jsx>, {}), c);
    });
    expect(capturedValue).toBe('hi from server');
  });

  it('provides empty registry when __STEWIE_STATE__ is absent', () => {
    let capturedRegistry = null;
    function App() {
      capturedRegistry = useHydrationRegistry();
      return jsx('div', {});
    }

    const c = container();
    createRoot(() => {
      hydrate(jsx(App as unknown as () => ReturnType<typeof jsx>, {}), c);
    });
    expect(capturedRegistry).not.toBeNull();
    expect((capturedRegistry as { get: (k: string) => unknown } | null)?.get('missing')).toBeUndefined();
  });

  it('returns a dispose function', () => {
    const c = container();
    const dispose = hydrate(jsx('p', { children: 'test' }), c);
    expect(typeof dispose).toBe('function');
    expect(c.textContent).toBe('test');
    dispose();
    expect(c.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// hydrate — mismatch detection (dev mode)
// ---------------------------------------------------------------------------

describe('hydrate — mismatch detection', () => {
  it('does not warn when server and client HTML match', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = container();
    // Pre-populate with server HTML matching what the component will render
    c.innerHTML = '<p>hello</p>';
    hydrate(jsx('p', { children: 'hello' }), c);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns when client render differs from server HTML', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = container();
    c.innerHTML = '<p>server content</p>';
    hydrate(jsx('p', { children: 'client content' }), c);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[stewie] Hydration mismatch'),
      expect.anything(),
      expect.stringContaining('server content')
    );
    warnSpy.mockRestore();
  });

  it('does not warn when container was empty (fresh mount, no server HTML)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = container();
    hydrate(jsx('div', { children: 'fresh' }), c);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
