// @vitest-environment happy-dom
// Tests for CSS-load gating in lazy(). These tests exercise awaitStyles() and
// awaitOneStylesheet() behaviour indirectly by checking that the loaded signal
// does not flip until stylesheet load/error events fire.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { lazy } from './lazy.js';
import { jsx } from './jsx-runtime.js';
import { mount } from './dom-renderer.js';
import { reactiveScope } from './reactive.js';
import type { Component } from './jsx-runtime.js';

function RealComp() {
  return jsx('span', { children: 'gated' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush all pending microtasks. Two awaits cover factory().then + startLoad().then. */
async function flush(ticks = 4) {
  for (let i = 0; i < ticks; i++) await Promise.resolve();
}

function setManifest(manifest: Record<string, string[]> | undefined) {
  (window as Window & { __STEWIE_MANIFEST__?: Record<string, string[]> }).__STEWIE_MANIFEST__ = manifest;
}

function clearManifest() {
  delete (window as Window & { __STEWIE_MANIFEST__?: Record<string, string[]> }).__STEWIE_MANIFEST__;
}

/** Dispatch a synthetic load or error event on a link element. */
function fireEvent(el: EventTarget, type: 'load' | 'error') {
  el.dispatchEvent(new Event(type));
}

/** Find a <link rel="stylesheet" href="X"> in document.head. */
function findLink(href: string): HTMLLinkElement | null {
  return document.head.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][href="${CSS.escape(href)}"]`);
}

// ---------------------------------------------------------------------------
// Isolation: each test gets a clean head and a clean manifest. The
// stylesReadyCache in lazy.ts is module-level, so we can't clear it between
// tests. We work around this by using unique CSS URLs per test.
// ---------------------------------------------------------------------------

let urlCounter = 0;
function uniqueUrl() {
  return `/styles/test-${++urlCounter}.css`;
}

// Factory helper that resolves immediately with RealComp.
function immediateFactory() {
  return Promise.resolve({ default: RealComp as Component });
}

// Factory that we control the resolution of.
function deferredFactory(): [() => Promise<{ default: Component }>, (mod: { default: Component }) => void] {
  let resolve!: (mod: { default: Component }) => void;
  const promise = new Promise<{ default: Component }>((r) => {
    resolve = r;
  });
  return [() => promise, resolve];
}

beforeEach(() => {
  clearManifest();
  // Remove any stylesheet links left over from previous tests.
  document.head.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
});

afterEach(() => {
  clearManifest();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lazy() CSS-load gating', () => {
  it('no manifest set: resolves like before (no gating)', async () => {
    clearManifest();
    const LazyComp = lazy(immediateFactory, 'src/pages/Foo.tsx');
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });
    await flush();
    expect(container.textContent).toContain('gated');
  });

  it('manifest set, id absent from manifest: resolves immediately', async () => {
    setManifest({ 'src/pages/Other.tsx': ['/assets/other.css'] });
    const LazyComp = lazy(immediateFactory, 'src/pages/Foo.tsx');
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });
    await flush();
    expect(container.textContent).toContain('gated');
  });

  it('manifest set, no id on lazy(): resolves immediately', async () => {
    setManifest({ 'src/pages/Foo.tsx': ['/assets/foo.css'] });
    // No id argument — compiler-off path.
    const LazyComp = lazy(immediateFactory);
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });
    await flush();
    expect(container.textContent).toContain('gated');
  });

  it('manifest set, link already in DOM with link.sheet truthy: resolves immediately', async () => {
    const cssUrl = uniqueUrl();
    setManifest({ 'src/pages/Foo.tsx': [cssUrl] });

    // Inject the link and fake-populate link.sheet so the fast-path triggers.
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.appendChild(link);
    // happy-dom doesn't populate link.sheet automatically; patch it directly.
    Object.defineProperty(link, 'sheet', { value: {} as CSSStyleSheet, configurable: true });

    const LazyComp = lazy(immediateFactory, 'src/pages/Foo.tsx');
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });
    await flush();
    expect(container.textContent).toContain('gated');
  });

  it('manifest set, link in DOM but sheet null: waits for load event', async () => {
    const cssUrl = uniqueUrl();
    setManifest({ 'src/pages/Bar.tsx': [cssUrl] });

    // Inject link with sheet = null (simulates in-flight SSR-emitted link).
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.appendChild(link);
    // sheet is null by default in happy-dom — no patching needed.

    const [factory, resolveFactory] = deferredFactory();
    const LazyComp = lazy(factory, 'src/pages/Bar.tsx');
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });

    // Resolve factory first.
    resolveFactory({ default: RealComp });
    await flush();

    // Still not rendered — waiting on stylesheet load.
    expect(container.textContent).toBe('');

    // Fire the load event.
    fireEvent(link, 'load');
    await flush();

    expect(container.textContent).toContain('gated');
  });

  it('manifest set, link NOT in DOM (client-nav): injects link and waits', async () => {
    const cssUrl = uniqueUrl();
    setManifest({ 'src/pages/Baz.tsx': [cssUrl] });

    expect(findLink(cssUrl)).toBeNull();

    const [factory, resolveFactory] = deferredFactory();
    const LazyComp = lazy(factory, 'src/pages/Baz.tsx');
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });

    resolveFactory({ default: RealComp });
    await flush();

    // Link should have been injected.
    const link = findLink(cssUrl);
    expect(link).not.toBeNull();

    // Still blocked — waiting for load.
    expect(container.textContent).toBe('');

    fireEvent(link!, 'load');
    await flush();

    expect(container.textContent).toContain('gated');
  });

  it('stylesheet error event: resolves anyway (no permanent stall)', async () => {
    const cssUrl = uniqueUrl();
    setManifest({ 'src/pages/Err.tsx': [cssUrl] });

    const [factory, resolveFactory] = deferredFactory();
    const LazyComp = lazy(factory, 'src/pages/Err.tsx');
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyComp, {}), container);
    });

    resolveFactory({ default: RealComp });
    await flush();

    const link = findLink(cssUrl);
    expect(link).not.toBeNull();
    expect(container.textContent).toBe('');

    // Error instead of load — should still render.
    fireEvent(link!, 'error');
    await flush();

    expect(container.textContent).toContain('gated');
  });

  it('two boundaries sharing a URL: only one <link> injected', async () => {
    const sharedCss = uniqueUrl();
    setManifest({
      'src/pages/Alpha.tsx': [sharedCss],
      'src/pages/Beta.tsx': [sharedCss]
    });

    const [factoryA, resolveA] = deferredFactory();
    const [factoryB, resolveB] = deferredFactory();
    const LazyA = lazy(factoryA, 'src/pages/Alpha.tsx');
    const LazyB = lazy(factoryB, 'src/pages/Beta.tsx');

    const cA = document.createElement('div');
    const cB = document.createElement('div');
    reactiveScope(() => {
      mount(jsx(LazyA, {}), cA);
    });
    reactiveScope(() => {
      mount(jsx(LazyB, {}), cB);
    });

    resolveA({ default: RealComp });
    resolveB({ default: RealComp });
    await flush();

    // Both are waiting on the shared CSS — still only one link in the DOM.
    const links = document.head.querySelectorAll<HTMLLinkElement>(`link[rel="stylesheet"][href="${CSS.escape(sharedCss)}"]`);
    expect(links.length).toBe(1);

    fireEvent(links[0], 'load');
    await flush();

    // Both boundaries render after the shared link loads.
    expect(cA.textContent).toContain('gated');
    expect(cB.textContent).toContain('gated');
  });
});
