// assertions.ts — signal/store assertion helpers

import type { Signal } from '@stewie/core'

// Assert that a signal has the expected value
export function assertSignal<T>(sig: Signal<T>, expected: T): void {
  const actual = sig()
  if (actual !== expected) {
    throw new Error(
      `Expected signal value ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    )
  }
}

// Assert that a store path has the expected value.
// path is dot-separated: 'a.b.c'
export function assertStore<T extends object>(
  storeObj: T,
  path: string,
  expected: unknown
): void {
  const keys = path.split('.')
  let value: unknown = storeObj
  for (const key of keys) {
    value = (value as Record<string, unknown>)[key]
  }
  if (value !== expected) {
    throw new Error(
      `Expected store.${path} to be ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`
    )
  }
}
