// @vitest-environment happy-dom
/**
 * Regression tests for devtools update coalescing.
 *
 * Before this, every core dev hook drove DOM work synchronously inside the
 * effect that fired it. A route swap disposes every reactive node in the
 * outgoing subtree and creates every node in the incoming one, so the Graph
 * pane — which rebuilds itself with `innerHTML = ''` — was rebuilt O(nodes)
 * times per navigation, doing O(nodes²) DOM work. Panes also rendered while
 * the panel was collapsed or the tab inactive, and an element with several
 * bindings got one flash overlay per binding.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { effect, reactiveScope, signal } from '@stewie-js/core';
import { createPanel, destroyPanel, showPanel, hidePanel, togglePanel } from './panel.js';
import { installHooks, uninstallHooks } from './hooks.js';
import { flashElement, setHighlightEnabled, _pendingFlashCount } from './highlight.js';

/** Count `innerHTML = ''` rebuilds on a pane. */
function countRebuilds(pane: HTMLElement): () => number {
  let n = 0;
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!;
  Object.defineProperty(pane, 'innerHTML', {
    configurable: true,
    get() {
      return desc.get!.call(this);
    },
    set(v: string) {
      if (v === '') n++;
      desc.set!.call(this, v);
    }
  });
  return () => n;
}

const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 1);
  });

/** Approximates one route swap: dispose N reactive nodes, create N more. */
function simulateNavigation(n: number): () => void {
  let disposeOutgoing: (() => void) | undefined;
  disposeOutgoing = reactiveScope(() => {
    const sigs = Array.from({ length: n }, (_, i) => signal(i));
    sigs.forEach((s) => effect(() => void s()));
  }) as unknown as () => void;
  disposeOutgoing?.();
  return reactiveScope(() => {
    const sigs = Array.from({ length: n }, (_, i) => signal(i));
    sigs.forEach((s) => effect(() => void s()));
  }) as unknown as () => void;
}

let root: HTMLElement;
let panes: NodeListOf<Element>;

beforeEach(() => {
  root = createPanel();
  document.body.appendChild(root);
  panes = root.querySelectorAll('.__sdt-pane');
  installHooks();
});

afterEach(async () => {
  uninstallHooks();
  destroyPanel();
  root.remove();
  setHighlightEnabled(true);
  // Drain any queued flash so pending state can't leak into the next test.
  await nextFrame();
});

describe('devtools update coalescing', () => {
  it('rebuilds the graph pane at most once per frame, regardless of node count', async () => {
    showPanel();
    // Graph is the 4th tab; make it the active one.
    (root.querySelectorAll('.__sdt-tab')[3] as HTMLElement).click();

    const rebuilds = countRebuilds(panes[3] as HTMLElement);
    const before = rebuilds();

    simulateNavigation(40);
    await nextFrame();

    const during = rebuilds() - before;
    expect(during).toBeGreaterThan(0); // it did render
    expect(during).toBeLessThanOrEqual(1); // …but only once
  });

  it('does no pane DOM work while the panel is collapsed', async () => {
    hidePanel();
    const rebuilds = countRebuilds(panes[3] as HTMLElement);
    const before = rebuilds();

    simulateNavigation(20);
    await nextFrame();

    expect(rebuilds() - before).toBe(0);
  });

  it('does no DOM work for a tab that is not active', async () => {
    showPanel();
    (root.querySelectorAll('.__sdt-tab')[0] as HTMLElement).click(); // Renders tab

    const graphRebuilds = countRebuilds(panes[3] as HTMLElement);
    const before = graphRebuilds();

    simulateNavigation(20);
    await nextFrame();

    expect(graphRebuilds() - before).toBe(0);
  });

  it('renders accumulated state when a hidden pane becomes visible', async () => {
    hidePanel();
    simulateNavigation(5);
    await nextFrame();

    const rebuilds = countRebuilds(panes[3] as HTMLElement);
    const before = rebuilds();

    showPanel();
    (root.querySelectorAll('.__sdt-tab')[3] as HTMLElement).click();

    // Switching to a dirty pane renders it immediately — no dropped updates.
    expect(rebuilds() - before).toBeGreaterThan(0);
    expect((panes[3] as HTMLElement).textContent).toContain('active node');
  });

  it('flashes an element once per frame even with several bindings on it', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    // One element, three reactive attributes → three flash requests.
    flashElement(el);
    flashElement(el);
    flashElement(el);

    expect(_pendingFlashCount()).toBe(1);
    el.remove();
  });

  it('still respects the highlight toggle', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    setHighlightEnabled(false);
    flashElement(el);
    expect(_pendingFlashCount()).toBe(0);
    el.remove();
  });

  it('toggling the panel does not lose pending updates', async () => {
    showPanel();
    (root.querySelectorAll('.__sdt-tab')[3] as HTMLElement).click();
    togglePanel(); // hide

    simulateNavigation(3);
    await nextFrame();

    togglePanel(); // show again
    expect((panes[3] as HTMLElement).textContent).toContain('active node');
  });
});
