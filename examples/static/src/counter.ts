import { signal, computed, _setAllowReactiveCreation } from '@stewie/core'

export interface Counter {
  count: () => number
  doubled: () => number
  increment: () => void
  decrement: () => void
  reset: () => void
}

// Factory function (NOT module-level signals)
export function createCounter(initialValue = 0): Counter {
  _setAllowReactiveCreation(true)
  const count = signal(initialValue)
  const doubled = computed(() => count() * 2)
  _setAllowReactiveCreation(false)

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
