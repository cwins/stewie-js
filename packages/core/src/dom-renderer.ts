// dom-renderer.ts — client-side DOM renderer for @stewie-js/core
// Takes JSXElement descriptors (or DOM Nodes from the DOM JSX runtime) and
// renders them into real DOM nodes with fine-grained reactive subscriptions.

import {
  effect,
  reactiveScope,
  untrack,
  _setNextEffectMeta,
  _pushComponent,
  _popComponent,
  _setAppMounted,
  isDev,
  ComputedNode,
  signal,
  batch
} from './reactive.js';
import { Fragment } from './jsx-runtime.js';
import type { JSXElement, Component } from './jsx-runtime.js';
import { _pushContext, _popContext } from './context.js';
import type { ContextProvider } from './context.js';
import { HydrationCursor } from './hydration-cursor.js';
import { _LazyBoundary } from './lazy.js';
import type { _LazyBoundaryProps } from './lazy.js';

type ElementType = JSXElement['type'];
import { Show, For, Switch, Match, Portal, ErrorBoundary, Suspense, ClientOnly } from './components.js';

export type Disposer = () => void;

// Sentinel used to detect the first run of a function-child effect.
// A real child value can be JSXElement | string | number | null | boolean — never a Symbol.
const _UNSET = Symbol();

// ---------------------------------------------------------------------------
// Render scope — used by the DOM JSX runtime to collect effect disposers
// ---------------------------------------------------------------------------

let _renderScope: Disposer[] | null = null;

export function _setRenderScope(scope: Disposer[] | null): Disposer[] | null {
  const prev = _renderScope;
  _renderScope = scope;
  return prev;
}

// ---------------------------------------------------------------------------
// Hydration cursor — active cursor for the current rendering level.
// Non-null only during a hydrate() pass; null during normal mount().
// ---------------------------------------------------------------------------

let _hydrationCursor: HydrationCursor | null = null;

/**
 * Run `fn` with `_hydrationCursor` set to `cursor`, then restore the previous
 * cursor. This is the standard way to descend into a sub-tree while threading
 * a cursor through nested rendering calls.
 */
function _withCursor<T>(cursor: HydrationCursor | null, fn: () => T): T {
  const prev = _hydrationCursor;
  _hydrationCursor = cursor;
  try {
    return fn();
  } finally {
    _hydrationCursor = prev;
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function setProperty(el: Element, key: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    el.removeAttribute(key);
  } else if (key === 'class') {
    el.setAttribute('class', String(value));
  } else if (key === 'style' && typeof value === 'object') {
    Object.assign((el as HTMLElement).style, value as Record<string, string>);
  } else if (key in el && key !== 'list' && key !== 'type' && key !== 'form') {
    // Use DOM property for value, checked, disabled, etc.
    (el as unknown as Record<string, unknown>)[key] = value;
  } else {
    el.setAttribute(key, value === true ? '' : String(value));
  }
}

function isEventHandler(key: string): boolean {
  return key.length > 2 && key.startsWith('on') && key[2] === key[2].toUpperCase();
}

function insertBefore(parent: Node, child: Node, before: Node | null): void {
  if (before !== null) {
    parent.insertBefore(child, before);
  } else {
    parent.appendChild(child);
  }
}

// ---------------------------------------------------------------------------
// renderChildren — handles all child node types
// ---------------------------------------------------------------------------

function renderChildren(children: unknown, parent: Node, before: Node | null): Disposer {
  if (children === null || children === undefined || children === false) return () => {};

  if (Array.isArray(children)) {
    const disposers = children.map((child) => renderChildren(child, parent, before));
    return () => disposers.forEach((d) => d());
  }

  // Real DOM Node — from the DOM JSX runtime
  if (children instanceof Node) {
    insertBefore(parent, children, before);
    return () => (children as Node).parentNode?.removeChild(children as Node);
  }

  // Function child — reactive, re-renders when called value changes
  if (typeof children === 'function') {
    // During hydration, claim the existing content nodes up to the <!---->  anchor.
    const claimed = _hydrationCursor?.collectUntilComment('');
    const anchor = claimed?.anchor ?? document.createComment('');
    if (!claimed) insertBefore(parent, anchor, before);

    let childDisposer: Disposer = () => {};
    // Pre-populate with claimed nodes so the cleanup path always has the right set.
    let currentNodes: ChildNode[] = claimed ? claimed.contentNodes.slice() : [];
    let firstRun = !!claimed;
    // Memoize: skip DOM teardown/rebuild when the returned value is reference-equal
    // to the previous value. This prevents spurious DOM churn when a parent signal
    // changes but the property accessed by this child expression did not.
    let lastValue: unknown = _UNSET;

    if (isDev) _setNextEffectMeta({ type: 'children' });
    const disposeEffect = effect(() => {
      // Evaluate the children function and subscribe to its dependencies.
      // If the result is itself a function (Signal pattern — e.g. the compiler
      // emits `() => item().label` where `item().label` is a Signal), call
      // through one level within the same effect so that both the outer
      // function's dependencies AND the Signal's dependencies are tracked here.
      // This eliminates the nested anchor + effect that would otherwise be
      // created by a recursive renderChildren call, halving the DOM node and
      // reactive object count for this pattern.
      let value = (children as () => unknown)();
      if (typeof value === 'function') value = (value as () => unknown)();

      if (firstRun) {
        firstRun = false;
        // Subscribe to signals (children() call) AND wire reactive effects onto the
        // existing SSR nodes via a sub-cursor. No DOM insertions happen here.
        lastValue = value;
        const subCursor = new HydrationCursor(currentNodes);
        const frag = document.createDocumentFragment();
        childDisposer = _withCursor(subCursor, () => renderChildren(value, frag, null));
        // Any overflow (mismatch fallback): insert before anchor.
        if (frag.childNodes.length > 0) anchor.parentNode?.insertBefore(frag, anchor);
        return;
      }

      // If the value is reference-equal to the previous result, no DOM update is needed.
      // Catches the common case where a parent signal changed (e.g. task object replaced)
      // but the specific property read here (e.g. title) is the same primitive value.
      if (value === lastValue) return;
      lastValue = value;
      childDisposer();
      childDisposer = () => {};
      currentNodes.forEach((n) => n.parentNode?.removeChild(n));
      currentNodes = [];
      const frag = document.createDocumentFragment();
      childDisposer = renderChildren(value, frag, null);
      currentNodes = Array.from(frag.childNodes) as ChildNode[];
      anchor.parentNode?.insertBefore(frag, anchor);
    });

    return () => {
      disposeEffect();
      childDisposer();
      currentNodes.forEach((n) => n.parentNode?.removeChild(n));
      anchor.parentNode?.removeChild(anchor);
    };
  }

  if (typeof children === 'string' || typeof children === 'number' || typeof children === 'boolean') {
    // During hydration, claim the existing text node so we reuse it.
    const existing = _hydrationCursor?.claimText();
    if (existing) {
      existing.data = String(children);
      return () => existing.parentNode?.removeChild(existing);
    }
    const text = document.createTextNode(String(children));
    insertBefore(parent, text, before);
    return () => text.parentNode?.removeChild(text);
  }

  // JSXElement descriptor
  if (typeof children === 'object' && children !== null && 'type' in children) {
    return renderElement(children as JSXElement, parent, before);
  }

  return () => {};
}

// ---------------------------------------------------------------------------
// Control flow: Show
// ---------------------------------------------------------------------------

function renderShow(props: Record<string, unknown>, parent: Node, before: Node | null): Disposer {
  // During hydration, claim nodes up to the <!--Show--> anchor.
  const claimed = _hydrationCursor?.collectUntilComment('Show');
  const anchor = claimed?.anchor ?? document.createComment('Show');
  if (!claimed) insertBefore(parent, anchor, before);

  let childDisposer: Disposer = () => {};
  let currentNodes: ChildNode[] = [];
  let showing: boolean | null = null;
  let firstRun = false;

  if (claimed) {
    // Pre-populate to match the SSR state so the normal "no-op if unchanged" guard
    // exits early after the first subscription is established.
    const whenVal = typeof props.when === 'function' ? untrack(() => (props.when as () => unknown)()) : props.when;
    showing = Boolean(whenVal);
    currentNodes = claimed.contentNodes.slice();
    firstRun = true;
  }

  if (isDev) _setNextEffectMeta({ type: 'show', anchor });
  const disposeEffect = effect(() => {
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when;
    const shouldShow = Boolean(when);

    if (firstRun) {
      firstRun = false;
      // Wire reactive effects onto existing SSR nodes via a sub-cursor.
      // The nodes are already correctly positioned in the DOM — no insertions.
      if (shouldShow) {
        const subCursor = new HydrationCursor(claimed!.contentNodes);
        const frag = document.createDocumentFragment();
        childDisposer = _withCursor(subCursor, () => renderChildren(props.children, frag, null));
        if (frag.childNodes.length > 0) anchor.parentNode?.insertBefore(frag, anchor);
      } else if (!shouldShow && props.fallback !== undefined) {
        const subCursor = new HydrationCursor(claimed!.contentNodes);
        const frag = document.createDocumentFragment();
        childDisposer = _withCursor(subCursor, () => renderChildren(props.fallback, frag, null));
        if (frag.childNodes.length > 0) anchor.parentNode?.insertBefore(frag, anchor);
      }
      return;
    }

    if (shouldShow === showing) return;
    showing = shouldShow;

    childDisposer();
    childDisposer = () => {};
    currentNodes.forEach((n) => n.parentNode?.removeChild(n));
    currentNodes = [];

    const frag = document.createDocumentFragment();
    if (shouldShow) {
      childDisposer = renderChildren(props.children, frag, null);
    } else if (props.fallback !== undefined) {
      childDisposer = renderChildren(props.fallback, frag, null);
    }
    currentNodes = Array.from(frag.childNodes) as ChildNode[];
    anchor.parentNode?.insertBefore(frag, anchor);
  });

  return () => {
    disposeEffect();
    childDisposer();
    currentNodes.forEach((n) => n.parentNode?.removeChild(n));
    anchor.parentNode?.removeChild(anchor);
  };
}

// ---------------------------------------------------------------------------
// LIS (Longest Increasing Subsequence) for keyed For reconciliation
//
// Given a sequence of old DOM indices (-1 = new item, excluded from LIS),
// returns the Set of positions in the sequence that form the LIS.
// Items at LIS positions are already in correct relative order and need
// no DOM move; only non-LIS items are repositioned.
// Time: O(n log n).  Space: O(n).
// ---------------------------------------------------------------------------

function computeLIS(seq: number[]): Set<number> {
  const n = seq.length;
  // tails[k] = index into seq of the smallest tail for an IS of length k+1
  const tails: number[] = [];
  // parent[i] = predecessor index in seq for the IS ending at i (-1 = none)
  const parent: number[] = Array.from({ length: n }, () => -1);

  for (let i = 0; i < n; i++) {
    const v = seq[i];
    if (v === -1) continue; // new item — skip

    // Binary search: leftmost position where seq[tails[pos]] >= v
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (seq[tails[mid]] < v) lo = mid + 1;
      else hi = mid;
    }
    parent[i] = lo > 0 ? tails[lo - 1] : -1;
    if (lo === tails.length) tails.push(i);
    else tails[lo] = i;
  }

  // Backtrack from the last tail to collect the actual LIS indices
  const result = new Set<number>();
  if (tails.length === 0) return result;
  let cur = tails[tails.length - 1];
  while (cur !== -1) {
    result.add(cur);
    cur = parent[cur];
  }
  return result;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// renderWithRoot — render inside a reactive ownership scope so that
// computed() / effect() calls during rendering are owned by this scope and
// disposed automatically when the returned Disposer is called.
// Used by renderFor to give each list item its own lifetime.
// ---------------------------------------------------------------------------

function renderWithRoot(fn: () => Disposer): Disposer {
  let rootDispose: Disposer = () => {};
  let childDisposer: Disposer = () => {};
  reactiveScope((dispose) => {
    rootDispose = dispose;
    childDisposer = fn();
  });
  return () => {
    rootDispose();
    childDisposer();
  };
}

// ---------------------------------------------------------------------------
// Control flow: For
// ---------------------------------------------------------------------------

function renderFor(props: Record<string, unknown>, parent: Node, before: Node | null): Disposer {
  // During hydration, claim nodes up to the <!--For--> anchor.
  // This must happen before the keyed/unkeyed split since both paths share the anchor.
  const claimed = _hydrationCursor?.collectUntilComment('For');
  const anchor = claimed?.anchor ?? document.createComment('For');
  if (!claimed) insertBefore(parent, anchor, before);

  const renderFn = props.children as (item: () => unknown, index: () => number) => JSXElement;
  const keyFn = typeof props.by === 'function' ? (props.by as (item: unknown, index: number) => unknown) : null;

  if (keyFn) {
    // Keyed mode: diff by key so stable items reuse their DOM nodes and effects.
    //
    // Uses a Longest Increasing Subsequence (LIS) approach to find the minimum
    // number of DOM moves required. Items in the LIS are already in correct
    // relative order and never move; only the O(k) non-LIS items are repositioned.
    // This reduces a 2-element swap from ~998 DOM moves to 2.
    interface KeyedEntry {
      nodes: ChildNode[];
      disposer: Disposer;
      setItem: (item: unknown) => void;
      setIndex: (idx: number) => void;
    }
    const keyMap = new Map<unknown, KeyedEntry>();
    // Keys in their current DOM order — maintained across renders to avoid
    // re-reading the DOM on every reconciliation.
    let prevKeys: unknown[] = [];
    let firstRun = !!claimed;

    if (isDev) _setNextEffectMeta({ type: 'for', anchor });
    const disposeEffect = effect(() => {
      const each = typeof props.each === 'function' ? (props.each as () => unknown[])() : (props.each as unknown[]);

      if (firstRun) {
        firstRun = false;
        if (claimed && Array.isArray(each)) {
          // Shared sub-cursor walks through contentNodes sequentially.
          // Each item claims as many nodes as it needs; idx advances accordingly.
          const subCursor = new HydrationCursor(claimed.contentNodes);
          for (let i = 0; i < each.length; i++) {
            const key = keyFn(each[i], i);
            const startIdx = subCursor.idx;
            const itemFrag = document.createDocumentFragment();
            const itemSig = signal<unknown>(each[i]);
            const idxSig = signal<number>(i);
            const disposer = renderWithRoot(() =>
              _withCursor(subCursor, () =>
                renderChildren(
                  renderFn(
                    () => itemSig(),
                    () => idxSig()
                  ),
                  itemFrag,
                  null
                )
              )
            );
            const claimedCount = subCursor.idx - startIdx;
            const itemNodes = claimed.contentNodes.slice(startIdx, startIdx + claimedCount) as ChildNode[];
            const entry: KeyedEntry = {
              disposer,
              setItem: (item) => itemSig.set(item),
              setIndex: (idx) => idxSig.set(idx),
              nodes: []
            };
            // Handle mismatch overflow (nodes that weren't claimed from the cursor).
            if (itemFrag.childNodes.length > 0) {
              const overflowNodes = Array.from(itemFrag.childNodes) as ChildNode[];
              anchor.parentNode?.insertBefore(itemFrag, anchor);
              entry.nodes = [...itemNodes, ...overflowNodes];
            } else {
              entry.nodes = itemNodes;
            }
            keyMap.set(key, entry);
          }
          prevKeys = each.map((item, i) => keyFn(item, i));
        }
        return;
      }

      if (!Array.isArray(each)) {
        keyMap.forEach(({ nodes, disposer }) => {
          disposer();
          nodes.forEach((n) => n.parentNode?.removeChild(n));
        });
        keyMap.clear();
        prevKeys = [];
        return;
      }

      const newKeys = each.map((item, i) => keyFn(item, i));
      const newKeySet = new Set(newKeys);

      // 1. Remove entries whose keys are no longer in the list.
      //    Build currentKeys = prevKeys minus removed keys (preserves DOM order).
      let currentKeys: unknown[];
      if (prevKeys.length === 0) {
        currentKeys = [];
      } else {
        currentKeys = [];
        for (let i = 0; i < prevKeys.length; i++) {
          const k = prevKeys[i];
          if (newKeySet.has(k)) {
            currentKeys.push(k);
          } else {
            const entry = keyMap.get(k)!;
            entry.disposer();
            entry.nodes.forEach((n) => n.parentNode?.removeChild(n));
            keyMap.delete(k);
          }
        }
      }

      // 2. Render new items and refresh existing ones.
      //    New entries are created with a per-item signal so the render function
      //    receives a live accessor rather than a captured snapshot.
      //    Existing entries just update their signals — DOM nodes are preserved.
      batch(() => {
        for (let i = 0; i < each.length; i++) {
          const key = newKeys[i];
          if (!keyMap.has(key)) {
            const frag = document.createDocumentFragment();
            const itemSig = signal<unknown>(each[i]);
            const idxSig = signal<number>(i);
            const disposer = renderWithRoot(() =>
              renderChildren(
                renderFn(
                  () => itemSig(),
                  () => idxSig()
                ),
                frag,
                null
              )
            );
            const nodes = Array.from(frag.childNodes) as ChildNode[];
            keyMap.set(key, {
              nodes,
              disposer,
              setItem: (item) => itemSig.set(item),
              setIndex: (idx) => idxSig.set(idx)
            });
          } else {
            // Stable key — update item and index in place; DOM nodes are reused as-is.
            const entry = keyMap.get(key)!;
            entry.setItem(each[i]);
            entry.setIndex(i);
          }
        }
      });

      // 3. Find which positions in newKeys are already in a stable (non-moving)
      //    relative order via LIS on their old DOM indices.
      //    New items (not in currentKeys) get oldIdx = -1 and are excluded from
      //    the LIS — they always need to be inserted.
      const keyToOldIdx = new Map<unknown, number>();
      for (let i = 0; i < currentKeys.length; i++) keyToOldIdx.set(currentKeys[i], i);

      const oldIdxSeq: number[] = Array.from({ length: newKeys.length });
      for (let i = 0; i < newKeys.length; i++) {
        oldIdxSeq[i] = keyToOldIdx.get(newKeys[i]) ?? -1;
      }

      const stable = computeLIS(oldIdxSeq);

      // 4. Backward pass: move non-stable items, advance insertRef past stable items.
      //    Stable items are already in correct relative order — touching them would
      //    be wasted DOM work (and would cause cascading moves for swap operations).
      let insertRef: Node = anchor;
      for (let i = newKeys.length - 1; i >= 0; i--) {
        const entry = keyMap.get(newKeys[i])!;
        if (entry.nodes.length === 0) continue;
        if (stable.has(i)) {
          // Already in place relative to its neighbours — just advance the cursor.
          insertRef = entry.nodes[0];
        } else {
          // Move (or insert) before insertRef.
          const frag = document.createDocumentFragment();
          for (const node of entry.nodes) frag.appendChild(node);
          anchor.parentNode?.insertBefore(frag, insertRef);
          insertRef = entry.nodes[0];
        }
      }

      // 5. Record the new DOM order for the next reconciliation.
      prevKeys = newKeys.slice();
    });

    return () => {
      disposeEffect();
      keyMap.forEach(({ nodes, disposer }) => {
        disposer();
        nodes.forEach((n) => n.parentNode?.removeChild(n));
      });
      keyMap.clear();
      anchor.parentNode?.removeChild(anchor);
    };
  }

  // Unkeyed mode (no key prop): teardown and rebuild the whole list on each change.
  // Simple and correct for static or small lists. Use key={fn} for large or
  // interactive lists where DOM identity preservation matters.
  let childDisposers: Disposer[] = [];
  let currentNodes: ChildNode[] = claimed ? claimed.contentNodes.slice() : [];
  let firstRun = !!claimed;

  if (isDev) _setNextEffectMeta({ type: 'for' });
  const disposeEffect = effect(() => {
    const each = typeof props.each === 'function' ? (props.each as () => unknown[])() : (props.each as unknown[]);

    if (firstRun) {
      firstRun = false;
      if (claimed && Array.isArray(each)) {
        const subCursor = new HydrationCursor(claimed.contentNodes);
        const frag = document.createDocumentFragment();
        childDisposers = _withCursor(subCursor, () =>
          each.map((item, i) =>
            renderWithRoot(() =>
              renderChildren(
                renderFn(
                  () => item,
                  () => i
                ),
                frag,
                null
              )
            )
          )
        );
        if (frag.childNodes.length > 0) anchor.parentNode?.insertBefore(frag, anchor);
      }
      return;
    }

    childDisposers.forEach((d) => d());
    childDisposers = [];
    currentNodes.forEach((n) => n.parentNode?.removeChild(n));
    currentNodes = [];

    if (!Array.isArray(each)) return;

    const frag = document.createDocumentFragment();
    childDisposers = each.map((item, i) =>
      renderWithRoot(() =>
        renderChildren(
          renderFn(
            () => item,
            () => i
          ),
          frag,
          null
        )
      )
    );
    currentNodes = Array.from(frag.childNodes) as ChildNode[];
    anchor.parentNode?.insertBefore(frag, anchor);
  });

  return () => {
    disposeEffect();
    childDisposers.forEach((d) => d());
    currentNodes.forEach((n) => n.parentNode?.removeChild(n));
    anchor.parentNode?.removeChild(anchor);
  };
}

// ---------------------------------------------------------------------------
// Control flow: Switch / Match
// ---------------------------------------------------------------------------

function renderSwitch(props: Record<string, unknown>, parent: Node, before: Node | null): Disposer {
  // During hydration, claim nodes up to the <!--Switch--> anchor.
  const claimed = _hydrationCursor?.collectUntilComment('Switch');
  const anchor = claimed?.anchor ?? document.createComment('Switch');
  if (!claimed) insertBefore(parent, anchor, before);

  let childDisposer: Disposer = () => {};
  let currentNodes: ChildNode[] = claimed ? claimed.contentNodes.slice() : [];
  let firstRun = !!claimed;

  if (isDev) _setNextEffectMeta({ type: 'switch', anchor });
  const disposeEffect = effect(() => {
    const children = Array.isArray(props.children) ? props.children : [props.children];

    if (firstRun) {
      firstRun = false;
      // Find the active branch and wire reactive effects onto existing SSR nodes.
      let matched = false;
      for (const child of children as JSXElement[]) {
        if (!child || child.type !== (Match as unknown)) continue;
        const matchProps = child.props as { when: unknown; children: unknown };
        const when = typeof matchProps.when === 'function' ? (matchProps.when as () => unknown)() : matchProps.when;
        if (when) {
          matched = true;
          const content =
            typeof matchProps.children === 'function' ? (matchProps.children as (v: unknown) => JSXElement)(when) : matchProps.children;
          const subCursor = new HydrationCursor(claimed!.contentNodes);
          const frag = document.createDocumentFragment();
          childDisposer = _withCursor(subCursor, () => renderChildren(content, frag, null));
          if (frag.childNodes.length > 0) anchor.parentNode?.insertBefore(frag, anchor);
          break;
        }
      }
      if (!matched && props.fallback !== undefined) {
        const subCursor = new HydrationCursor(claimed!.contentNodes);
        const frag = document.createDocumentFragment();
        childDisposer = _withCursor(subCursor, () => renderChildren(props.fallback, frag, null));
        if (frag.childNodes.length > 0) anchor.parentNode?.insertBefore(frag, anchor);
      }
      return;
    }

    childDisposer();
    childDisposer = () => {};
    currentNodes.forEach((n) => n.parentNode?.removeChild(n));
    currentNodes = [];

    let matched = false;

    for (const child of children as JSXElement[]) {
      if (!child || child.type !== (Match as unknown)) continue;
      const matchProps = child.props as { when: unknown; children: unknown };
      const when = typeof matchProps.when === 'function' ? (matchProps.when as () => unknown)() : matchProps.when;
      if (when) {
        matched = true;
        const frag = document.createDocumentFragment();
        const content =
          typeof matchProps.children === 'function' ? (matchProps.children as (v: unknown) => JSXElement)(when) : matchProps.children;
        childDisposer = renderChildren(content, frag, null);
        currentNodes = Array.from(frag.childNodes) as ChildNode[];
        anchor.parentNode?.insertBefore(frag, anchor);
        break;
      }
    }

    if (!matched && props.fallback !== undefined) {
      const frag = document.createDocumentFragment();
      childDisposer = renderChildren(props.fallback, frag, null);
      currentNodes = Array.from(frag.childNodes) as ChildNode[];
      anchor.parentNode?.insertBefore(frag, anchor);
    }
  });

  return () => {
    disposeEffect();
    childDisposer();
    currentNodes.forEach((n) => n.parentNode?.removeChild(n));
    anchor.parentNode?.removeChild(anchor);
  };
}

// ---------------------------------------------------------------------------
// Control flow: Suspense
// ---------------------------------------------------------------------------

/**
 * Renders Suspense children. If the children throw a Promise (e.g. from
 * resource().read()), shows the fallback until the Promise resolves, then
 * re-renders the children (which should now succeed).
 *
 * The "seen" Set prevents infinite loops if the same Promise is thrown again.
 */
function renderSuspense(props: Record<string, unknown>, parent: Node, before: Node | null): Disposer {
  const anchor = document.createComment('Suspense');
  insertBefore(parent, anchor, before);

  let activeNodes: ChildNode[] = [];
  let activeDisposer: Disposer = () => {};
  const seenPromises = new Set<Promise<unknown>>();
  let retryCount = 0;
  const MAX_RETRIES = 10;

  function clearActive(): void {
    activeDisposer();
    activeDisposer = () => {};
    activeNodes.forEach((n) => n.parentNode?.removeChild(n));
    activeNodes = [];
  }

  function tryRenderContent(): void {
    try {
      const frag = document.createDocumentFragment();
      activeDisposer = renderChildren(props.children, frag, null);
      activeNodes = Array.from(frag.childNodes) as ChildNode[];
      anchor.parentNode?.insertBefore(frag, anchor);
    } catch (thrown) {
      if (thrown instanceof Promise && !seenPromises.has(thrown) && retryCount < MAX_RETRIES) {
        seenPromises.add(thrown);
        retryCount++;
        // Show fallback while the Promise is pending.
        const frag = document.createDocumentFragment();
        activeDisposer = renderChildren(props.fallback, frag, null);
        activeNodes = Array.from(frag.childNodes) as ChildNode[];
        anchor.parentNode?.insertBefore(frag, anchor);

        thrown.then(
          () => {
            clearActive();
            tryRenderContent();
          },
          // On rejection leave fallback visible; let ErrorBoundary above handle errors.
          () => {}
        );
      } else {
        // Re-throw non-Promise throws, repeated Promises, or retry-limit exceeded.
        anchor.parentNode?.removeChild(anchor);
        throw thrown;
      }
    }
  }

  tryRenderContent();

  return () => {
    clearActive();
    anchor.parentNode?.removeChild(anchor);
  };
}

// ---------------------------------------------------------------------------
// Control flow: LazyBoundary — handles lazy() components
// ---------------------------------------------------------------------------

function renderLazy(props: _LazyBoundaryProps, parent: Node, before: Node | null): Disposer {
  // During hydration, claim nodes up to the <!--Lazy--> anchor.
  // The named marker distinguishes this boundary from the generic <!---->
  // used for function children, preventing cursor ambiguity when a lazy
  // component is nested inside a reactive parent (e.g. Router matchedContent).
  const claimed = _hydrationCursor?.collectUntilComment('Lazy');
  const anchor = claimed?.anchor ?? document.createComment('Lazy');
  if (!claimed) insertBefore(parent, anchor, before);

  let childDisposer: Disposer = () => {};
  let currentNodes: ChildNode[] = claimed ? claimed.contentNodes.slice() : [];
  let firstRun = !!claimed;

  if (isDev) _setNextEffectMeta({ type: 'children' });
  const disposeEffect = effect(() => {
    const isLoaded = props.loaded();

    if (firstRun) {
      firstRun = false;
      if (isLoaded) {
        // Wire reactive effects onto existing SSR nodes — no DOM insertions.
        const subCursor = new HydrationCursor(claimed!.contentNodes);
        const frag = document.createDocumentFragment();
        childDisposer = _withCursor(subCursor, () => renderChildren(props.render(), frag, null));
        if (frag.childNodes.length > 0) anchor.parentNode?.insertBefore(frag, anchor);
      }
      // !isLoaded: placeholder — nothing to render, anchor marks empty region.
      return;
    }

    // After firstRun: loaded changed (false → true). Re-render.
    childDisposer();
    childDisposer = () => {};
    currentNodes.forEach((n) => n.parentNode?.removeChild(n));
    currentNodes = [];

    if (isLoaded) {
      const frag = document.createDocumentFragment();
      childDisposer = renderChildren(props.render(), frag, null);
      currentNodes = Array.from(frag.childNodes) as ChildNode[];
      anchor.parentNode?.insertBefore(frag, anchor);
    }
  });

  return () => {
    disposeEffect();
    childDisposer();
    currentNodes.forEach((n) => n.parentNode?.removeChild(n));
    anchor.parentNode?.removeChild(anchor);
  };
}

// ---------------------------------------------------------------------------
// renderElement — dispatch on JSXElement type
// ---------------------------------------------------------------------------

function renderElement(el: JSXElement, parent: Node, before: Node | null): Disposer {
  const { type, props } = el;

  if (type === Fragment) {
    return renderChildren(props.children, parent, before);
  }

  if (type === (_LazyBoundary as unknown)) return renderLazy(props as unknown as _LazyBoundaryProps, parent, before);
  if (type === (Show as unknown)) return renderShow(props, parent, before);
  if (type === (For as unknown)) return renderFor(props, parent, before);
  if (type === (Switch as unknown)) return renderSwitch(props, parent, before);

  if (type === (Match as unknown)) {
    // Standalone Match (outside Switch) — treat like Show
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when;
    if (when) {
      const content = typeof props.children === 'function' ? (props.children as (v: unknown) => JSXElement)(when) : props.children;
      return renderChildren(content, parent, before);
    }
    return () => {};
  }

  if (type === (ClientOnly as unknown)) {
    // Always renders on client
    return renderChildren(props.children, parent, before);
  }

  if (type === (Suspense as unknown)) {
    return renderSuspense(props, parent, before);
  }

  if (type === (Portal as unknown)) {
    let target: Element;
    if (typeof props.target === 'string') {
      target = document.querySelector(props.target as string) ?? document.body;
    } else if (props.target instanceof Element) {
      target = props.target;
    } else {
      target = document.body;
    }
    return renderChildren(props.children, target, null);
  }

  if (type === (ErrorBoundary as unknown)) {
    try {
      return renderChildren(props.children, parent, before);
    } catch (err) {
      if (typeof props.fallback === 'function') {
        return renderChildren((props.fallback as (err: unknown) => JSXElement)(err), parent, before);
      }
      return renderChildren(props.fallback, parent, before);
    }
  }

  // Context.Provider — push value onto provider stack for the lifetime of these children
  if (
    type != null &&
    (typeof type === 'function' || typeof type === 'object') &&
    (type as unknown as ContextProvider<unknown>)._isProvider
  ) {
    const provider = type as unknown as ContextProvider<unknown>;
    _pushContext(provider._context, props.value);
    const childDisposer = renderChildren(props.children, parent, before);
    return () => {
      childDisposer();
      _popContext(provider._context);
    };
  }

  // Component function — wrap in reactiveScope so signal() is allowed inside,
  // and run the component body with untrack() so that signal reads in the
  // component's render output do not create dependencies on any parent effect
  // (e.g. the routing effect must not re-run when a form-field signal changes).
  // The dispose callback from reactiveScope disposes all effects the component
  // created in its body when the component is unmounted.
  //
  // If the component throws (e.g. resource().read() throws a Promise for Suspense),
  // dispose any reactive effects created before the throw to prevent leaks, then
  // re-throw so the nearest Suspense or ErrorBoundary can catch it.
  if (typeof type === 'function') {
    let rootDispose: Disposer = () => {};
    let result: unknown;
    if (isDev) _pushComponent((type as { name?: string }).name || 'Anonymous');
    try {
      untrack(() => {
        reactiveScope((dispose) => {
          rootDispose = dispose;
          try {
            result = (type as Component)(props);
          } catch (err) {
            dispose(); // clean up effects created before the throw
            throw err;
          }
        });
      });
      // Keep the component name on the stack through renderChildren so that
      // Show/For/Switch effects created while processing this component's
      // returned JSX pick up the correct component name in their devMeta.
      const childDisposer = renderChildren(result, parent, before);
      return () => {
        rootDispose();
        childDisposer();
      };
    } finally {
      if (isDev) _popComponent();
    }
  }

  // Native DOM element — during hydration, try to claim the existing SSR node.
  const existingEl = _hydrationCursor?.claimElement(type as string);
  const domEl = existingEl ?? document.createElement(type as string);
  const disposers: Disposer[] = [];

  for (const [key, value] of Object.entries(props)) {
    if (key === 'children') continue;

    if (key === 'ref') {
      if (typeof value === 'function') {
        (value as (el: Element) => void)(domEl);
      }
      continue;
    }

    if (isEventHandler(key) && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      domEl.addEventListener(eventName, value as EventListener);
      disposers.push(() => domEl.removeEventListener(eventName, value as EventListener));
      continue;
    }

    if (typeof value === 'function') {
      // Reactive prop — memoize via ComputedNode so the DOM-update effect only
      // re-runs when the derived value actually changes, not on every dependency
      // invalidation (e.g. clicking one row doesn't repaint all other rows).
      if (isDev) _setNextEffectMeta({ element: domEl, attr: key, type: 'prop' });
      const memo = new ComputedNode(value as () => unknown);
      disposers.push(effect(() => setProperty(domEl, key, memo.read())));
      disposers.push(() => memo.dispose());
    } else {
      setProperty(domEl, key, value);
    }
  }

  if (props.children !== undefined) {
    if (existingEl) {
      // Render children with a fresh cursor scoped to this element's existing children.
      const childCursor = new HydrationCursor(existingEl.childNodes);
      disposers.push(_withCursor(childCursor, () => renderChildren(props.children, domEl, null)));
    } else {
      disposers.push(renderChildren(props.children, domEl, null));
    }
  }

  // Only insert the element if it was freshly created; claimed elements are already in the DOM.
  if (!existingEl) {
    insertBefore(parent, domEl, before);
  }

  return () => {
    disposers.forEach((d) => d());
    domEl.parentNode?.removeChild(domEl);
  };
}

// ---------------------------------------------------------------------------
// _createNode — creates a DOM Node for use by the DOM JSX runtime
// ---------------------------------------------------------------------------

/**
 * Creates a real DOM Node from a JSX type + props.
 * Called by the DOM JSX runtime (packages/core/dom/jsx-runtime.ts).
 * The created element's disposer is registered with the current render scope
 * so mount() can clean everything up.
 */
export function _createNode(type: ElementType, props: Record<string, unknown>): Node {
  const frag = document.createDocumentFragment();
  const disposer = renderElement({ type, props, key: null }, frag, null);
  if (_renderScope) {
    _renderScope.push(disposer);
  }
  if (frag.childNodes.length === 1) {
    return frag.firstChild!;
  }
  return frag;
}

// ---------------------------------------------------------------------------
// mount — public API
// ---------------------------------------------------------------------------

/**
 * Mount a JSX tree into a DOM container.
 *
 * Accepts two forms:
 *   - Descriptor mode:  mount(jsx('div', {...}), container)
 *   - DOM runtime mode: mount(() => jsx('div', {...}), container)  ← uses DOM JSX runtime
 *
 * Returns a dispose function that unmounts and cleans up all reactive effects.
 */
export function mount(root: JSXElement | Node | (() => JSXElement | Node | null) | null, container: Element): Disposer {
  // Suppress the module-scope reactive creation warning from this point on.
  // Event handlers and other post-mount callbacks are safe to create reactive
  // primitives without a reactiveScope() wrapper — no SSR singleton-leak risk.
  _setAppMounted();

  // Clear the container
  while (container.firstChild) container.removeChild(container.firstChild);

  // Activate render scope so the DOM JSX runtime can register disposers
  const scopeDisposers: Disposer[] = [];
  const prevScope = _setRenderScope(scopeDisposers);

  let value: unknown;
  let rootDispose: Disposer = () => {};
  try {
    value =
      typeof root === 'function'
        ? reactiveScope((dispose) => {
            rootDispose = dispose;
            return (root as () => unknown)();
          })
        : root;
  } finally {
    _setRenderScope(prevScope);
  }

  if (value === null || value === undefined) return () => {};

  // DOM runtime mode: root returned a real Node
  if (value instanceof Node) {
    container.appendChild(value);
    return () => {
      rootDispose();
      scopeDisposers.forEach((d) => d());
    };
  }

  // Descriptor mode: render the JSXElement tree
  const disposer = renderChildren(value as JSXElement, container, null);
  return () => {
    rootDispose();
    disposer();
  };
}

// ---------------------------------------------------------------------------
// _hydrateInto — like mount() but reuses existing SSR DOM nodes
// ---------------------------------------------------------------------------

/**
 * Render a JSX tree into a container that already contains server-rendered HTML.
 *
 * Instead of clearing and remounting (like mount()), this walks the existing
 * childNodes via `cursor` and claims live DOM nodes for the renderer to attach
 * reactive effects to. Freshly created nodes are only emitted when the SSR
 * DOM is missing or mismatched.
 *
 * Used exclusively by hydrate() in hydrate.ts.
 */
export function _hydrateInto(
  root: JSXElement | Node | (() => JSXElement | Node | null) | null,
  container: Element,
  cursor: HydrationCursor
): Disposer {
  const scopeDisposers: Disposer[] = [];
  const prevScope = _setRenderScope(scopeDisposers);

  let value: unknown;
  let rootDispose: Disposer = () => {};
  try {
    value =
      typeof root === 'function'
        ? reactiveScope((dispose) => {
            rootDispose = dispose;
            return (root as () => unknown)();
          })
        : root;
  } finally {
    _setRenderScope(prevScope);
  }

  if (value === null || value === undefined) return () => {};

  // DOM runtime mode: root returned a real Node — no cursor support for this path
  if (value instanceof Node) {
    container.appendChild(value);
    return () => {
      rootDispose();
      scopeDisposers.forEach((d) => d());
    };
  }

  // Descriptor mode: render with the hydration cursor active
  const disposer = _withCursor(cursor, () => renderChildren(value as JSXElement, container, null));
  return () => {
    rootDispose();
    disposer();
  };
}
