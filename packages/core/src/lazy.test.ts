// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { lazy } from './lazy.js';
import { jsx } from './jsx-runtime.js';
import { mount } from './dom-renderer.js';
import { hydrate } from './hydrate.js';
import { reactiveScope } from './reactive.js';
import type { Component } from './jsx-runtime.js';

function RealComp() {
  return jsx('span', { children: 'loaded' });
}

describe('lazy()', () => {
  it('renders null while the import is pending', () => {
    let resolveLoad!: (mod: { default: Component }) => void;
    const factory = () =>
      new Promise<{ default: Component }>((r) => {
        resolveLoad = r;
      });
    const LazyComp = lazy(factory);

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });

    // Nothing rendered yet
    expect(container.textContent).toBe('');

    // Prevent unresolved promise from leaking
    resolveLoad({ default: RealComp });
  });

  it('renders the real component after the import resolves', async () => {
    let resolveLoad!: (mod: { default: Component }) => void;
    const factory = () =>
      new Promise<{ default: Component }>((r) => {
        resolveLoad = r;
      });
    const LazyComp = lazy(factory);

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });

    expect(container.textContent).toBe('');

    // Resolve the import
    resolveLoad({ default: RealComp });
    // Flush microtasks so the then() callback and the reactive effect run
    await Promise.resolve();
    await Promise.resolve();

    expect(container.textContent).toContain('loaded');
  });

  it('renders immediately when already loaded (second mount)', async () => {
    let resolveLoad!: (mod: { default: Component }) => void;
    const factory = () =>
      new Promise<{ default: Component }>((r) => {
        resolveLoad = r;
      });
    const LazyComp = lazy(factory);

    // First mount — starts loading
    const c1 = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), c1);
    });
    resolveLoad({ default: RealComp });
    await Promise.resolve();
    await Promise.resolve();
    expect(c1.textContent).toContain('loaded');

    // Second mount — component is already loaded, renders immediately
    const c2 = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), c2);
    });
    // No await needed — should already show content
    expect(c2.textContent).toContain('loaded');
  });

  it('hydration: keeps SSR-rendered DOM in place until factory resolves, then attaches without re-render', async () => {
    let resolveLoad!: (mod: { default: Component }) => void;
    const factory = () =>
      new Promise<{ default: Component }>((r) => {
        resolveLoad = r;
      });
    const LazyComp = lazy(factory);

    // Simulate SSR-rendered DOM: a <span>loaded</span> inside the lazy boundary,
    // followed by the named <!--Lazy--> anchor the dom-renderer expects.
    const container = document.createElement('div');
    container.innerHTML = '<span>loaded</span><!--Lazy-->';
    const ssrSpan = container.querySelector('span')!;

    reactiveScope(() => {
      hydrate(jsx(LazyComp, {}), container);
    });

    // Factory hasn't resolved — SSR DOM must remain visible (no flicker, no removal).
    expect(container.textContent).toBe('loaded');
    expect(container.querySelector('span')).toBe(ssrSpan);

    // Resolve the dynamic import.
    resolveLoad({ default: RealComp });
    await Promise.resolve();
    await Promise.resolve();

    // After hydration the same span node is still in the DOM (reactive effects
    // were attached, not re-rendered).
    expect(container.textContent).toContain('loaded');
    expect(container.querySelector('span')).toBe(ssrSpan);
  });

  it('supports ES module default export pattern', async () => {
    let resolveLoad!: (mod: { default: Component }) => void;
    const factory = () =>
      new Promise<{ default: Component }>((r) => {
        resolveLoad = r;
      });
    const LazyComp = lazy(factory);

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });

    // Resolve as ES module with .default property
    resolveLoad({ default: RealComp });
    await Promise.resolve();
    await Promise.resolve();

    expect(container.textContent).toContain('loaded');
  });
});
