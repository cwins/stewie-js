import { describe, it, expect } from 'vitest'
import { matchRoute, sortRoutes } from './matcher.js'

describe('matchRoute', () => {
  it('matches static routes', () => {
    const result = matchRoute('/about', '/about')
    expect(result).not.toBeNull()
    expect(result!.params).toEqual({})
  })

  it('matches root path', () => {
    const result = matchRoute('/', '/')
    expect(result).not.toBeNull()
    expect(result!.params).toEqual({})
  })

  it('extracts params from dynamic segments', () => {
    const result = matchRoute('/users/:id', '/users/42')
    expect(result).not.toBeNull()
    expect(result!.params).toEqual({ id: '42' })
  })

  it('returns null when pattern does not match', () => {
    const result = matchRoute('/users/:id', '/about')
    expect(result).toBeNull()
  })

  it('matches nested dynamic segments', () => {
    const result = matchRoute('/users/:id/posts', '/users/42/posts')
    expect(result).not.toBeNull()
    expect(result!.params).toEqual({ id: '42' })
  })

  it('returns null for empty param (trailing slash)', () => {
    const result = matchRoute('/users/:id', '/users/')
    expect(result).toBeNull()
  })

  it('returns null when segment counts differ', () => {
    expect(matchRoute('/users/:id', '/users/42/extra')).toBeNull()
    expect(matchRoute('/users/:id/posts', '/users/42')).toBeNull()
  })

  it('static routes score higher than param routes', () => {
    const staticResult = matchRoute('/users/me', '/users/me')
    const paramResult = matchRoute('/users/:id', '/users/me')
    expect(staticResult).not.toBeNull()
    expect(paramResult).not.toBeNull()
    expect(staticResult!.score).toBeGreaterThan(paramResult!.score)
  })

  it('handles multiple params', () => {
    const result = matchRoute('/users/:userId/posts/:postId', '/users/42/posts/7')
    expect(result).not.toBeNull()
    expect(result!.params).toEqual({ userId: '42', postId: '7' })
  })

  it('returns null when pattern is longer than path', () => {
    const result = matchRoute('/a/b/c', '/a/b')
    expect(result).toBeNull()
  })
})

describe('sortRoutes', () => {
  it('orders routes by specificity (most specific first)', () => {
    const routes = [
      { path: '/users/:id' },
      { path: '/about' },
      { path: '/users/me' },
    ]
    const sorted = sortRoutes(routes)
    // '/about' and '/users/me' are static (score 10 each)
    // '/users/:id' has one static + one param (score 10+1=11)
    // '/users/me' has two statics (score 10+10=20) — most specific
    expect(sorted[0].path).toBe('/users/me')
    // '/users/:id' second (score 11)
    expect(sorted[1].path).toBe('/users/:id')
    // '/about' last (score 10)
    expect(sorted[2].path).toBe('/about')
  })

  it('does not mutate the original array', () => {
    const routes = [{ path: '/b' }, { path: '/a' }]
    const sorted = sortRoutes(routes)
    expect(routes[0].path).toBe('/b')
    expect(sorted).not.toBe(routes)
  })

  it('handles routes with same score stably', () => {
    const routes = [
      { path: '/a' },
      { path: '/b' },
      { path: '/c' },
    ]
    const sorted = sortRoutes(routes)
    expect(sorted).toHaveLength(3)
  })
})
