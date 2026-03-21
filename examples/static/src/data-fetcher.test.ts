import { describe, it, expect, vi } from 'vitest'
import { createDataFetcher } from './data-fetcher.js'

describe('createDataFetcher', () => {
  it('starts in idle state', () => {
    const fetcher = createDataFetcher<{ name: string }>()
    expect(fetcher.state().status).toBe('idle')
  })

  it('transitions to loading, then success', async () => {
    const fetcher = createDataFetcher<{ name: string }>()

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'test' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const fetchPromise = fetcher.fetch('https://api.example.com/data')
    expect(fetcher.state().status).toBe('loading')

    await fetchPromise
    const state = fetcher.state()
    expect(state.status).toBe('success')
    if (state.status === 'success') {
      expect(state.data).toEqual({ name: 'test' })
    }

    vi.unstubAllGlobals()
  })

  it('transitions to error on failure', async () => {
    const fetcher = createDataFetcher<unknown>()

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetcher.fetch('https://api.example.com/missing')
    const state = fetcher.state()
    expect(state.status).toBe('error')

    vi.unstubAllGlobals()
  })

  it('resets to idle', async () => {
    const fetcher = createDataFetcher<unknown>()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }))
    await fetcher.fetch('https://example.com')

    fetcher.reset()
    expect(fetcher.state().status).toBe('idle')

    vi.unstubAllGlobals()
  })
})
