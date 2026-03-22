// data-fetcher.ts — generic async data fetcher with reactive state
//
// Demonstrates signal() for tracking async operation state across
// idle → loading → success/error transitions.

import { signal, createRoot } from '@stewie/core'
import type { Signal } from '@stewie/core'

export type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

export interface DataFetcher<T> {
  state: Signal<FetchState<T>>
  fetch: (url: string) => Promise<void>
  reset: () => void
}

export function createDataFetcher<T>(): DataFetcher<T> {
  let state!: Signal<FetchState<T>>

  createRoot(() => {
    state = signal<FetchState<T>>({ status: 'idle' })
  })

  return {
    state,
    async fetch(url: string) {
      state.set({ status: 'loading' })
      try {
        const res = await globalThis.fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as T
        state.set({ status: 'success', data })
      } catch (err) {
        state.set({ status: 'error', error: err as Error })
      }
    },
    reset() {
      state.set({ status: 'idle' })
    },
  }
}
