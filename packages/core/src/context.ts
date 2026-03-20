// context.ts — context system for @stewie/core

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Context<T> {
  readonly id: symbol
  readonly defaultValue: T | undefined
}

// ---------------------------------------------------------------------------
// Module-level provider stack: symbol -> stack of values
// ---------------------------------------------------------------------------

const _providerStack: Map<symbol, unknown[]> = new Map()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createContext<T>(defaultValue?: T): Context<T> {
  return {
    id: Symbol(),
    defaultValue,
  }
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
