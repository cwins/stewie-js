import { signal, _setAllowReactiveCreation } from '@stewie/core'

export type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

export interface DataFetcher<T> {
  state: () => FetchState<T>
  fetch: (url: string) => Promise<void>
  reset: () => void
}

export function createDataFetcher<T>(): DataFetcher<T> {
  _setAllowReactiveCreation(true)
  const state = signal<FetchState<T>>({ status: 'idle' })
  _setAllowReactiveCreation(false)

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
