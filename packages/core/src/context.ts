// context.ts — context system for @stewie-js/core

import type { JSXElement } from './jsx-runtime.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A context provider component marker. Recognized by both the SSR renderer and
 * the DOM renderer, which handle it before the generic component-function path.
 * Using the Provider as a component in JSX keeps context active for the
 * entire subtree, safely crossing async boundaries in the SSR renderer.
 */
export type ContextProvider<T> = ((props: { value: T; children?: unknown }) => JSXElement | null) & {
  readonly _isProvider: true
  readonly _context: Context<T>
}

export interface Context<T> {
  readonly id: symbol
  readonly defaultValue: T | undefined
  /** JSX-compatible provider: <ctx.Provider value={v}>{children}</ctx.Provider> */
  readonly Provider: ContextProvider<T>
}

/**
 * A snapshot of the currently-active context values, keyed by context id.
 * Used by the SSR renderer to thread context across async render boundaries.
 */
export type ContextSnapshot = ReadonlyMap<symbol, unknown>

// ---------------------------------------------------------------------------
// Module-level provider stack: symbol -> stack of values
// ---------------------------------------------------------------------------

export const _providerStack: Map<symbol, unknown[]> = new Map()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createContext<T>(defaultValue?: T): Context<T> {
  // Forward reference so the Provider closure can reference ctx
  let ctx!: Context<T>

  // The Provider is callable so it satisfies JSX.Element type constraints.
  // Both renderers detect _isProvider BEFORE calling it as a function, so
  // the body is only a synchronous fallback for renderers that don't support it.
  const provider = function (props: { value: T; children?: unknown }): JSXElement | null {
    // Synchronous fallback: wrap children in a provide() scope.
    // Works only when the renderer processes children synchronously.
    return provide(ctx, props.value, () => props.children) as JSXElement | null
  } as ContextProvider<T>
  ;(provider as { _isProvider: boolean })._isProvider = true
  ;(provider as { _context: Context<T> })._context = null! // patched below

  ctx = { id: Symbol(), defaultValue, Provider: provider }
  ;(provider as { _context: Context<T> })._context = ctx
  return ctx
}

export function provide<T, R>(context: Context<T>, value: T, fn: () => R): R {
  const { id } = context
  let stack = _providerStack.get(id) as T[] | undefined
  if (!stack) {
    stack = []
    _providerStack.set(id, stack)
  }
  stack.push(value)
  try {
    return fn()
  } finally {
    stack.pop()
    if (stack.length === 0) {
      _providerStack.delete(id)
    }
  }
}

export function inject<T>(context: Context<T>): T {
  const { id, defaultValue } = context
  const stack = _providerStack.get(id) as T[] | undefined
  if (stack && stack.length > 0) {
    return stack[stack.length - 1]
  }
  if (defaultValue !== undefined) {
    return defaultValue
  }
  // Check if context was created with an explicit undefined default or no default at all.
  // If defaultValue is undefined but was explicitly provided, we'd need extra tracking.
  // The spec says: throw if no provider AND no default. We treat undefined defaultValue
  // as "no default" since createContext() with no arg sets it to undefined.
  // To distinguish, we check if the context object has a default set at construction.
  // Since we store undefined for "no default", we throw here.
  throw new Error('[stewie] inject() called with no matching provider and no default value')
}

// ---------------------------------------------------------------------------
// Context snapshot — used by the SSR renderer for async-safe context threading
// ---------------------------------------------------------------------------

/**
 * Capture the current top-of-stack value for each active context.
 * Returns a snapshot that can be restored with runWithContext().
 */
export function captureContext(): ContextSnapshot {
  const snap = new Map<symbol, unknown>()
  for (const [key, stack] of _providerStack) {
    if (stack.length > 0) snap.set(key, stack[stack.length - 1])
  }
  return snap
}

/**
 * Run fn with the given snapshot as the active context.
 * Values in the snapshot are temporarily pushed onto the provider stack,
 * then popped after fn returns. Existing stack entries are preserved and
 * restored afterwards.
 */
export function runWithContext<R>(snapshot: ContextSnapshot, fn: () => R): R {
  const pushed: symbol[] = []
  for (const [id, value] of snapshot) {
    let stack = _providerStack.get(id)
    if (!stack) {
      stack = []
      _providerStack.set(id, stack)
    }
    stack.push(value)
    pushed.push(id)
  }
  try {
    return fn()
  } finally {
    for (const id of pushed) {
      const stack = _providerStack.get(id)!
      stack.pop()
      if (stack.length === 0) _providerStack.delete(id)
    }
  }
}

// ---------------------------------------------------------------------------
// Internal push/pop helpers — used by the DOM renderer's Provider handling
// ---------------------------------------------------------------------------

/** Push a context value onto the stack. Must be paired with _popContext. */
export function _pushContext<T>(context: Context<T>, value: T): void {
  const { id } = context
  let stack = _providerStack.get(id) as T[] | undefined
  if (!stack) {
    stack = []
    _providerStack.set(id, stack as unknown[])
  }
  stack.push(value)
}

/** Pop the most recently pushed value for this context. */
export function _popContext<T>(context: Context<T>): void {
  const { id } = context
  const stack = _providerStack.get(id) as T[] | undefined
  if (stack) {
    stack.pop()
    if (stack.length === 0) _providerStack.delete(id)
  }
}
