// dom-renderer.ts — client-side DOM renderer for @stewie/core
// Takes JSXElement descriptors (or DOM Nodes from the DOM JSX runtime) and
// renders them into real DOM nodes with fine-grained reactive subscriptions.

import { effect, createRoot } from './reactive.js'
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
// Control flow: For
// ---------------------------------------------------------------------------

function renderFor(props: Record<string, unknown>, parent: Node, before: Node | null): Disposer {
  const anchor = document.createComment('For')
  insertBefore(parent, anchor, before)
  let childDisposers: Disposer[] = []
  let currentNodes: ChildNode[] = []

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

    const renderFn = props.children as (item: unknown, index: number) => JSXElement
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

  // Component function — wrap in createRoot so signal() is allowed inside
  if (typeof type === 'function') {
    const disposers: Disposer[] = []
    let result: unknown
    createRoot(() => {
      result = (type as Component)(props)
    })
    disposers.push(renderChildren(result, parent, before))
    return () => disposers.forEach((d) => d())
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
  try {
    value = typeof root === 'function' ? createRoot(() => (root as () => unknown)()) : root
  } finally {
    _setRenderScope(prevScope)
  }

  if (value === null || value === undefined) return () => {}

  // DOM runtime mode: root returned a real Node
  if (value instanceof Node) {
    container.appendChild(value)
    return () => {
      scopeDisposers.forEach((d) => d())
    }
  }

  // Descriptor mode: render the JSXElement tree
  const disposer = renderChildren(value as JSXElement, container, null)
  return disposer
}
