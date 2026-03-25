// counter.ts — reactive counter factory
//
// Demonstrates signal() and computed() created inside a createRoot() scope,
// the correct way to create reactive primitives outside a component function.

import { signal, computed, createRoot } from '@stewie-js/core'
import type { Signal, Computed } from '@stewie-js/core'

export interface Counter {
  count: Signal<number>
  doubled: Computed<number>
  increment(): void
  decrement(): void
  reset(): void
}

export function createCounter(initialValue = 0): Counter {
  let count!: Signal<number>
  let doubled!: Computed<number>

  // createRoot() is the correct way to create reactive primitives outside
  // a component function. Signals created here are scoped to this root.
  createRoot(() => {
    count = signal(initialValue)
    doubled = computed(() => count() * 2)
  })

  return {
    count,
    doubled,
    increment() {
      count.update((n) => n + 1)
    },
    decrement() {
      count.update((n) => n - 1)
    },
    reset() {
      count.set(initialValue)
    },
  }
}
