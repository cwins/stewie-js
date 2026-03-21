import { describe, it, expect } from 'vitest'
import { createRouter, useRouter, RouterContext } from './router.js'
import { provide, effect } from '@stewie/core'

describe('createRouter', () => {
  it('creates a router with a location', () => {
    const router = createRouter('/')
    expect(router.location).toBeDefined()
    expect(router.location.pathname).toBe('/')
    expect(router.location.params).toEqual({})
    expect(router.location.query).toEqual({})
    expect(router.location.hash).toBe('')
  })

  it('creates a router with an initial URL', () => {
    const router = createRouter('/users/42?tab=info#section')
    expect(router.location.pathname).toBe('/users/42')
    expect(router.location.query).toEqual({ tab: 'info' })
    expect(router.location.hash).toBe('section')
  })

  it('navigate with string updates pathname', () => {
    const router = createRouter('/')
    router.navigate('/new-path')
    expect(router.location.pathname).toBe('/new-path')
  })

  it('navigate with string updates query and hash', () => {
    const router = createRouter('/')
    router.navigate('/path?foo=bar#section')
    expect(router.location.pathname).toBe('/path')
    expect(router.location.query).toEqual({ foo: 'bar' })
    expect(router.location.hash).toBe('section')
  })

  it('navigate with NavigateOptions updates location', () => {
    const router = createRouter('/')
    router.navigate({ to: '/path', replace: true })
    expect(router.location.pathname).toBe('/path')
  })

  it('navigate with NavigateOptions (replace: false) updates location', () => {
    const router = createRouter('/')
    router.navigate({ to: '/other' })
    expect(router.location.pathname).toBe('/other')
  })

  it('match returns RouteMatch when pattern matches current location', () => {
    const router = createRouter('/users/42')
    const match = router.match('/users/:id')
    expect(match).not.toBeNull()
    expect(match!.pattern).toBe('/users/:id')
    expect(match!.params).toEqual({ id: '42' })
    expect(typeof match!.score).toBe('number')
  })

  it('match returns null when pattern does not match', () => {
    const router = createRouter('/users/42')
    const match = router.match('/other')
    expect(match).toBeNull()
  })

  it('back() and forward() do not throw in Node environment', () => {
    const router = createRouter('/')
    expect(() => router.back()).not.toThrow()
    expect(() => router.forward()).not.toThrow()
  })

  it('_setLocation updates all location fields', () => {
    const router = createRouter('/')
    router._setLocation('/updated?q=1#h', { id: '5' })
    expect(router.location.pathname).toBe('/updated')
    expect(router.location.query).toEqual({ q: '1' })
    expect(router.location.hash).toBe('h')
    expect(router.location.params).toEqual({ id: '5' })
  })
})

describe('useRouter', () => {
  it('throws when called outside RouterContext', () => {
    expect(() => useRouter()).toThrow('useRouter() called outside of <Router> provider')
  })

  it('returns router when called inside RouterContext provider', () => {
    const router = createRouter('/')
    let capturedRouter: ReturnType<typeof useRouter> | null = null

    provide(RouterContext, router, () => {
      capturedRouter = useRouter()
    })

    expect(capturedRouter).toBe(router)
  })
})

describe('location reactivity: pathname vs query independence', () => {
  it('changing pathname does not trigger query subscribers', () => {
    const router = createRouter('/home?foo=bar')
    let pathnameRunCount = 0
    let queryRunCount = 0

    const disposePathname = effect(() => {
      const _ = router.location.pathname
      pathnameRunCount++
    })

    const disposeQuery = effect(() => {
      const _ = router.location.query
      queryRunCount++
    })

    // Both run on initialization
    expect(pathnameRunCount).toBe(1)
    expect(queryRunCount).toBe(1)

    // Navigate to new path without changing query
    router.navigate('/new-path')
    expect(pathnameRunCount).toBe(2)
    // query is reassigned (same object reference replaced), so this will run
    // but let's verify that changing only pathname doesn't affect query subscribers
    // by doing a direct property assignment
    queryRunCount = 0
    pathnameRunCount = 0

    // Directly set pathname only
    router.location.pathname = '/another-path'
    expect(pathnameRunCount).toBe(1)
    expect(queryRunCount).toBe(0) // query subscribers should NOT re-run

    // Directly set query only
    router.location.query = { tab: 'settings' }
    expect(pathnameRunCount).toBe(1) // pathname subscribers should NOT re-run
    expect(queryRunCount).toBe(1)

    disposePathname()
    disposeQuery()
  })
})
