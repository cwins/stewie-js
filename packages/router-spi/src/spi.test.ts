import { describe, it, expect } from 'vitest'
import type { StewieRouterSPI, ReactiveLocation, NavigateOptions, RouteMatch } from './index.js'

describe('@stewie-js/router-spi interface definitions', () => {
  it('NavigateOptions type works correctly', () => {
    const opts: NavigateOptions = { to: '/path' }
    expect(opts.to).toBe('/path')
    expect(opts.replace).toBeUndefined()

    const optsWithReplace: NavigateOptions = { to: '/other', replace: true }
    expect(optsWithReplace.replace).toBe(true)

    const optsWithState: NavigateOptions = { to: '/state', state: { from: 'home' } }
    expect(optsWithState.state).toEqual({ from: 'home' })
  })

  it('RouteMatch type works correctly', () => {
    const match: RouteMatch = {
      pattern: '/users/:id',
      params: { id: '42' },
      score: 10,
    }
    expect(match.pattern).toBe('/users/:id')
    expect(match.params).toEqual({ id: '42' })
    expect(match.score).toBe(10)
  })

  it('ReactiveLocation type works correctly', () => {
    const loc: ReactiveLocation = {
      pathname: '/users/42',
      params: { id: '42' },
      query: { tab: 'info' },
      hash: 'section',
    }
    expect(loc.pathname).toBe('/users/42')
    expect(loc.params).toEqual({ id: '42' })
    expect(loc.query).toEqual({ tab: 'info' })
    expect(loc.hash).toBe('section')
  })

  it('StewieRouterSPI mock implementation satisfies the interface', () => {
    // A mock class that structurally satisfies StewieRouterSPI
    class MockRouter implements StewieRouterSPI {
      readonly location: ReactiveLocation = {
        pathname: '/',
        params: {},
        query: {},
        hash: '',
      }

      navigateCalls: Array<string | NavigateOptions> = []
      backCalls = 0
      forwardCalls = 0

      navigate(to: string | NavigateOptions): Promise<void> {
        this.navigateCalls.push(to)
        if (typeof to === 'string') {
          this.location.pathname = to
        } else {
          this.location.pathname = to.to
        }
        return Promise.resolve()
      }

      back(): void {
        this.backCalls++
      }

      forward(): void {
        this.forwardCalls++
      }

      match(pattern: string): RouteMatch | null {
        if (pattern === this.location.pathname) {
          return { pattern, params: {}, score: 100 }
        }
        return null
      }
    }

    const router = new MockRouter()

    // Test navigate with string
    router.navigate('/about')
    expect(router.location.pathname).toBe('/about')
    expect(router.navigateCalls).toEqual(['/about'])

    // Test navigate with NavigateOptions
    router.navigate({ to: '/users', replace: true })
    expect(router.location.pathname).toBe('/users')
    expect(router.navigateCalls[1]).toEqual({ to: '/users', replace: true })

    // Test back/forward
    router.back()
    expect(router.backCalls).toBe(1)
    router.forward()
    expect(router.forwardCalls).toBe(1)

    // Test match
    const match = router.match('/users')
    expect(match).not.toBeNull()
    expect(match!.pattern).toBe('/users')
    expect(match!.params).toEqual({})
    expect(match!.score).toBe(100)

    const noMatch = router.match('/other')
    expect(noMatch).toBeNull()
  })

  it('StewieRouterSPI can be used as a type constraint', () => {
    function getPathname(router: StewieRouterSPI): string {
      return router.location.pathname
    }

    const mockRouter: StewieRouterSPI = {
      location: {
        pathname: '/test',
        params: {},
        query: {},
        hash: '',
      },
      navigate: () => Promise.resolve(),
      back: () => {},
      forward: () => {},
      match: () => null,
    }

    expect(getPathname(mockRouter)).toBe('/test')
  })
})
