// dom-renderer.ts — client-side DOM renderer for @stewie-js/core
// Takes JSXElement descriptors (or DOM Nodes from the DOM JSX runtime) and
// renders them into real DOM nodes with fine-grained reactive subscriptions.

import { effect, createRoot, untrack, _setNextEffectMeta, isDev } from './reactive.js'
import { Fragment } from './jsx-runtime.js'
import type { JSXElement, Component } from './jsx-runtime.js'
import { _pushContext, _popContext } from './context.js'
import type { ContextProvider } from './context.js'

type ElementType = JSXElement['type']
import {
  Show,
  For,
  Switch,
  Match,
  Portal,
  ErrorBoundary,
  Suspense,
  ClientOnly,
} from './components.js'

export type Disposer = () => void

// ---------------------------------------------------------------------------
// Render scope — used by the DOM JSX runtime to collect effect disposers
// ---------------------------------------------------------------------------

let _renderScope: Disposer[] | null = null

export function _setRenderScope(scope: Disposer[] | null): Disposer[] | null {
  const prev = _renderScope
  _renderScope = scope
  return prev
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function setProperty(el: Element, key: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    el.removeAttribute(key)
  } else if (key === 'class') {
    el.setAttribute('class', String(value))
  } else if (key === 'style' && typeof value === 'object') {
    Object.assign((el as HTMLElement).style, value as Record<string, string>)
  } else if (key in el && key !== 'list' && key !== 'type' && key !== 'form') {
    // Use DOM property for value, checked, disabled, etc.
    ;(el as unknown as Record<string, unknown>)[key] = value
  } else {
    el.setAttribute(key, value === true ? '' : String(value))
  }
}

function isEventHandler(key: string): boolean {
  return key.length > 2 && key.startsWith('on') && key[2] === key[2].toUpperCase()
}

function insertBefore(parent: Node, child: Node, before: Node | null): void {
  if (before !== null) {
    parent.insertBefore(child, before)
  } else {
    parent.appendChild(child)
  }
}

// ---------------------------------------------------------------------------
// renderChildren — handles all child node types
// ---------------------------------------------------------------------------

function renderChildren(children: unknown, parent: Node, before: Node | null): Disposer {
  if (children === null || children === undefined || children === false) return () => {}

  if (Array.isArray(children)) {
    const disposers = children.map((child) => renderChildren(child, parent, before))
    return () => disposers.forEach((d) => d())
  }

  // Real DOM Node — from the DOM JSX runtime
  if (children instanceof Node) {
    insertBefore(parent, children, before)
    return () => (children as Node).parentNode?.removeChild(children as Node)
  }

  // Function child — reactive, re-renders when called value changes
  if (typeof children === 'function') {
    const anchor = document.createComment('')
    insertBefore(parent, anchor, before)
    let childDisposer: Disposer = () => {}
    let currentNodes: ChildNode[] = []

    if (isDev) _setNextEffectMeta({ type: 'children' })
    const disposeEffect = effect(() => {
      const value = (children as () => unknown)()
      childDisposer()
      childDisposer = () => {}
      currentNodes.forEach((n) => n.parentNode?.removeChild(n))
      currentNodes = []
      const frag = document.createDocumentFragment()
      childDisposer = renderChildren(value, frag, null)
      currentNodes = Array.from(frag.childNodes) as ChildNode[]
      anchor.parentNode?.insertBefore(frag, anchor)
    })

    return () => {
      disposeEffect()
      childDisposer()
      currentNodes.forEach((n) => n.parentNode?.removeChild(n))
      anchor.parentNode?.removeChild(anchor)
    }
  }

  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    typeof children === 'boolean'
  ) {
    const text = document.createTextNode(String(children))
    insertBefore(parent, text, before)
    return () => text.parentNode?.removeChild(text)
  }

  // JSXElement descriptor
  if (typeof children === 'object' && children !== null && 'type' in children) {
    return renderElement(children as JSXElement, parent, before)
  }

  return () => {}
}

// ---------------------------------------------------------------------------
// Control flow: Show
// ---------------------------------------------------------------------------

function renderShow(props: Record<string, unknown>, parent: Node, before: Node | null): Disposer {
  const anchor = document.createComment('Show')
  insertBefore(parent, anchor, before)
  let childDisposer: Disposer = () => {}
  let currentNodes: ChildNode[] = []
  let showing: boolean | null = null

  if (isDev) _setNextEffectMeta({ type: 'show' })
  const disposeEffect = effect(() => {
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when
    const shouldShow = Boolean(when)
    if (shouldShow === showing) return
    showing = shouldShow

    childDisposer()
    childDisposer = () => {}
    currentNodes.forEach((n) => n.parentNode?.removeChild(n))
    currentNodes = []

    const frag = document.createDocumentFragment()
    if (shouldShow) {
      childDisposer = renderChildren(props.children, frag, null)
    } else if (props.fallback !== undefined) {
      childDisposer = renderChildren(props.fallback, frag, null)
    }
    currentNodes = Array.from(frag.childNodes) as ChildNode[]
    anchor.parentNode?.insertBefore(frag, anchor)
  })

  return () => {
    disposeEffect()
    childDisposer()
    currentNodes.forEach((n) => n.parentNode?.removeChild(n))
    anchor.parentNode?.removeChild(anchor)
  }
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
  const n = seq.length
  // tails[k] = index into seq of the smallest tail for an IS of length k+1
  const tails: number[] = []
  // parent[i] = predecessor index in seq for the IS ending at i (-1 = none)
  const parent: number[] = Array.from({ length: n }, () => -1)

  for (let i = 0; i < n; i++) {
    const v = seq[i]
    if (v === -1) continue // new item — skip

    // Binary search: leftmost position where seq[tails[pos]] >= v
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (seq[tails[mid]] < v) lo = mid + 1
      else hi = mid
    }
    parent[i] = lo > 0 ? tails[lo - 1] : -1
    if (lo === tails.length) tails.push(i)
    else tails[lo] = i
  }

  // Backtrack from the last tail to collect the actual LIS indices
  const result = new Set<number>()
  if (tails.length === 0) return result
  let cur = tails[tails.length - 1]
  while (cur !== -1) {
    result.add(cur)
    cur = parent[cur]
  }
  return result
}

// ---------------------------------------------------------------------------
// Control flow: For
// ---------------------------------------------------------------------------

function renderFor(props: Record<string, unknown>, parent: Node, before: Node | null): Disposer {
  const anchor = document.createComment('For')
  insertBefore(parent, anchor, before)

  const renderFn = props.children as (item: unknown, index: number) => JSXElement
  const keyFn = typeof props.key === 'function'
    ? props.key as (item: unknown, index: number) => unknown
    : null

  if (keyFn) {
    // Keyed mode: diff by key so stable items reuse their DOM nodes and effects.
    //
    // Uses a Longest Increasing Subsequence (LIS) approach to find the minimum
    // number of DOM moves required. Items in the LIS are already in correct
    // relative order and never move; only the O(k) non-LIS items are repositioned.
    // This reduces a 2-element swap from ~998 DOM moves to 2.
    interface KeyedEntry { nodes: ChildNode[]; disposer: Disposer }
    const keyMap = new Map<unknown, KeyedEntry>()
    // Keys in their current DOM order — maintained across renders to avoid
    // re-reading the DOM on every reconciliation.
    let prevKeys: unknown[] = []

    if (isDev) _setNextEffectMeta({ type: 'for' })
    const disposeEffect = effect(() => {
      const each =
        typeof props.each === 'function'
          ? (props.each as () => unknown[])()
          : (props.each as unknown[])

      if (!Array.isArray(each)) {
        keyMap.forEach(({ nodes, disposer }) => {
          disposer()
          nodes.forEach((n) => n.parentNode?.removeChild(n))
        })
        keyMap.clear()
        prevKeys = []
        return
      }

      const newKeys = each.map((item, i) => keyFn(item, i))
      const newKeySet = new Set(newKeys)

      // 1. Remove entries whose keys are no longer in the list.
      //    Build currentKeys = prevKeys minus removed keys (preserves DOM order).
      let currentKeys: unknown[]
      if (prevKeys.length === 0) {
        currentKeys = []
      } else {
        currentKeys = []
        for (let i = 0; i < prevKeys.length; i++) {
          const k = prevKeys[i]
          if (newKeySet.has(k)) {
            currentKeys.push(k)
          } else {
            const entry = keyMap.get(k)!
            entry.disposer()
            entry.nodes.forEach((n) => n.parentNode?.removeChild(n))
            keyMap.delete(k)
          }
        }
      }

      // 2. Render new items not yet in the key map (detached; placed in step 4).
      for (let i = 0; i < each.length; i++) {
        const key = newKeys[i]
        if (!keyMap.has(key)) {
          const frag = document.createDocumentFragment()
          const disposer = renderChildren(renderFn(each[i], i), frag, null)
          const nodes = Array.from(frag.childNodes) as ChildNode[]
          keyMap.set(key, { nodes, disposer })
        }
      }

      // 3. Find which positions in newKeys are already in a stable (non-moving)
      //    relative order via LIS on their old DOM indices.
      //    New items (not in currentKeys) get oldIdx = -1 and are excluded from
      //    the LIS — they always need to be inserted.
      const keyToOldIdx = new Map<unknown, number>()
      for (let i = 0; i < currentKeys.length; i++) keyToOldIdx.set(currentKeys[i], i)

      const oldIdxSeq: number[] = Array.from({ length: newKeys.length })
      for (let i = 0; i < newKeys.length; i++) {
        oldIdxSeq[i] = keyToOldIdx.get(newKeys[i]) ?? -1
      }

      const stable = computeLIS(oldIdxSeq)

      // 4. Backward pass: move non-stable items, advance insertRef past stable items.
      //    Stable items are already in correct relative order — touching them would
      //    be wasted DOM work (and would cause cascading moves for swap operations).
      let insertRef: Node = anchor
      for (let i = newKeys.length - 1; i >= 0; i--) {
        const entry = keyMap.get(newKeys[i])!
        if (entry.nodes.length === 0) continue
        if (stable.has(i)) {
          // Already in place relative to its neighbours — just advance the cursor.
          insertRef = entry.nodes[0]
        } else {
          // Move (or insert) before insertRef.
          const frag = document.createDocumentFragment()
          for (const node of entry.nodes) frag.appendChild(node)
          anchor.parentNode?.insertBefore(frag, insertRef)
          insertRef = entry.nodes[0]
        }
      }

      // 5. Record the new DOM order for the next reconciliation.
      prevKeys = newKeys.slice()
    })

    return () => {
      disposeEffect()
      keyMap.forEach(({ nodes, disposer }) => {
        disposer()
        nodes.forEach((n) => n.parentNode?.removeChild(n))
      })
      keyMap.clear()
      anchor.parentNode?.removeChild(anchor)
    }
  }

  // Unkeyed mode (no key prop): teardown and rebuild the whole list on each change.
  // Simple and correct for static or small lists. Use key={fn} for large or
  // interactive lists where DOM identity preservation matters.
  let childDisposers: Disposer[] = []
  let currentNodes: ChildNode[] = []

  if (isDev) _setNextEffectMeta({ type: 'for' })
  const disposeEffect = effect(() => {
    const each =
      typeof props.each === 'function'
        ? (props.each as () => unknown[])()
        : (props.each as unknown[])

    childDisposers.forEach((d) => d())
    childDisposers = []
    currentNodes.forEach((n) => n.parentNode?.removeChild(n))
    currentNodes = []

    if (!Array.isArray(each)) return

    const frag = document.createDocumentFragment()
    childDisposers = each.map((item, i) => renderChildren(renderFn(item, i), frag, null))
    currentNodes = Array.from(frag.childNodes) as ChildNode[]
    anchor.parentNode?.insertBefore(frag, anchor)
  })

  return () => {
    disposeEffect()
    childDisposers.forEach((d) => d())
    currentNodes.forEach((n) => n.parentNode?.removeChild(n))
    anchor.parentNode?.removeChild(anchor)
  }
}

// ---------------------------------------------------------------------------
// Control flow: Switch / Match
// ---------------------------------------------------------------------------

function renderSwitch(props: Record<string, unknown>, parent: Node, before: Node | null): Disposer {
  const anchor = document.createComment('Switch')
  insertBefore(parent, anchor, before)
  let childDisposer: Disposer = () => {}
  let currentNodes: ChildNode[] = []

  if (isDev) _setNextEffectMeta({ type: 'switch' })
  const disposeEffect = effect(() => {
    childDisposer()
    childDisposer = () => {}
    currentNodes.forEach((n) => n.parentNode?.removeChild(n))
    currentNodes = []

    const children = Array.isArray(props.children) ? props.children : [props.children]
    let matched = false

    for (const child of children as JSXElement[]) {
      if (!child || child.type !== (Match as unknown)) continue
      const matchProps = child.props as { when: unknown; children: unknown }
      const when =
        typeof matchProps.when === 'function'
          ? (matchProps.when as () => unknown)()
          : matchProps.when
      if (when) {
        matched = true
        const frag = document.createDocumentFragment()
        const content =
          typeof matchProps.children === 'function'
            ? (matchProps.children as (v: unknown) => JSXElement)(when)
            : matchProps.children
        childDisposer = renderChildren(content, frag, null)
        currentNodes = Array.from(frag.childNodes) as ChildNode[]
        anchor.parentNode?.insertBefore(frag, anchor)
        break
      }
    }

    if (!matched && props.fallback !== undefined) {
      const frag = document.createDocumentFragment()
      childDisposer = renderChildren(props.fallback, frag, null)
      currentNodes = Array.from(frag.childNodes) as ChildNode[]
      anchor.parentNode?.insertBefore(frag, anchor)
    }
  })

  return () => {
    disposeEffect()
    childDisposer()
    currentNodes.forEach((n) => n.parentNode?.removeChild(n))
    anchor.parentNode?.removeChild(anchor)
  }
}

// ---------------------------------------------------------------------------
// renderElement — dispatch on JSXElement type
// ---------------------------------------------------------------------------

function renderElement(el: JSXElement, parent: Node, before: Node | null): Disposer {
  const { type, props } = el

  if (type === Fragment) {
    return renderChildren(props.children, parent, before)
  }

  if (type === (Show as unknown)) return renderShow(props, parent, before)
  if (type === (For as unknown)) return renderFor(props, parent, before)
  if (type === (Switch as unknown)) return renderSwitch(props, parent, before)

  if (type === (Match as unknown)) {
    // Standalone Match (outside Switch) — treat like Show
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when
    if (when) {
      const content =
        typeof props.children === 'function'
          ? (props.children as (v: unknown) => JSXElement)(when)
          : props.children
      return renderChildren(content, parent, before)
    }
    return () => {}
  }

  if (type === (ClientOnly as unknown)) {
    // Always renders on client
    return renderChildren(props.children, parent, before)
  }

  if (type === (Suspense as unknown)) {
    // Client-side: render children immediately (no streaming needed)
    return renderChildren(props.children, parent, before)
  }

  if (type === (Portal as unknown)) {
    let target: Element
    if (typeof props.target === 'string') {
      target = document.querySelector(props.target as string) ?? document.body
    } else if (props.target instanceof Element) {
      target = props.target
    } else {
      target = document.body
    }
    return renderChildren(props.children, target, null)
  }

  if (type === (ErrorBoundary as unknown)) {
    try {
      return renderChildren(props.children, parent, before)
    } catch (err) {
      if (typeof props.fallback === 'function') {
        return renderChildren((props.fallback as (err: unknown) => JSXElement)(err), parent, before)
      }
      return renderChildren(props.fallback, parent, before)
    }
  }

  // Context.Provider — push value onto provider stack for the lifetime of these children
  if (type != null && (typeof type === 'function' || typeof type === 'object') && (type as unknown as ContextProvider<unknown>)._isProvider) {
    const provider = type as unknown as ContextProvider<unknown>
    _pushContext(provider._context, props.value)
    const childDisposer = renderChildren(props.children, parent, before)
    return () => {
      childDisposer()
      _popContext(provider._context)
    }
  }

  // Component function — wrap in createRoot so signal() is allowed inside,
  // and run the component body with untrack() so that signal reads in the
  // component's render output do not create dependencies on any parent effect
  // (e.g. the routing effect must not re-run when a form-field signal changes).
  // The dispose callback from createRoot disposes all effects the component
  // created in its body when the component is unmounted.
  if (typeof type === 'function') {
    let rootDispose: Disposer = () => {}
    let result: unknown
    untrack(() => {
      createRoot((dispose) => {
        rootDispose = dispose
        result = (type as Component)(props)
      })
    })
    const childDisposer = renderChildren(result, parent, before)
    return () => {
      rootDispose()
      childDisposer()
    }
  }

  // Native DOM element
  const domEl = document.createElement(type as string)
  const disposers: Disposer[] = []

  for (const [key, value] of Object.entries(props)) {
    if (key === 'children') continue

    if (key === 'ref') {
      if (typeof value === 'function') {
        ;(value as (el: Element) => void)(domEl)
      }
      continue
    }

    if (isEventHandler(key) && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase()
      domEl.addEventListener(eventName, value as EventListener)
      disposers.push(() => domEl.removeEventListener(eventName, value as EventListener))
      continue
    }

    if (typeof value === 'function') {
      // Reactive prop — re-runs when the signal/computed changes
      if (isDev) _setNextEffectMeta({ element: domEl, attr: key, type: 'prop' })
      disposers.push(effect(() => setProperty(domEl, key, (value as () => unknown)())))
    } else {
      setProperty(domEl, key, value)
    }
  }

  if (props.children !== undefined) {
    disposers.push(renderChildren(props.children, domEl, null))
  }

  insertBefore(parent, domEl, before)

  return () => {
    disposers.forEach((d) => d())
    domEl.parentNode?.removeChild(domEl)
  }
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
  const frag = document.createDocumentFragment()
  const disposer = renderElement({ type, props, key: null }, frag, null)
  if (_renderScope) {
    _renderScope.push(disposer)
  }
  if (frag.childNodes.length === 1) {
    return frag.firstChild!
  }
  return frag
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
export function mount(
  root: JSXElement | Node | (() => JSXElement | Node | null) | null,
  container: Element,
): Disposer {
  // Clear the container
  while (container.firstChild) container.removeChild(container.firstChild)

  // Activate render scope so the DOM JSX runtime can register disposers
  const scopeDisposers: Disposer[] = []
  const prevScope = _setRenderScope(scopeDisposers)

  let value: unknown
  let rootDispose: Disposer = () => {}
  try {
    value =
      typeof root === 'function'
        ? createRoot((dispose) => {
            rootDispose = dispose
            return (root as () => unknown)()
          })
        : root
  } finally {
    _setRenderScope(prevScope)
  }

  if (value === null || value === undefined) return () => {}

  // DOM runtime mode: root returned a real Node
  if (value instanceof Node) {
    container.appendChild(value)
    return () => {
      rootDispose()
      scopeDisposers.forEach((d) => d())
    }
  }

  // Descriptor mode: render the JSXElement tree
  const disposer = renderChildren(value as JSXElement, container, null)
  return () => {
    rootDispose()
    disposer()
  }
}
