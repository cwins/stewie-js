import { describe, it, expect } from 'vitest'
import { createContext, provide, inject } from './context.js'

describe('createContext', () => {
  it('returns a context token with the default value', () => {
    const ctx = createContext('hello')
    expect(ctx.defaultValue).toBe('hello')
    expect(typeof ctx.id).toBe('symbol')
  })

  it('returns a context token with undefined default when no argument', () => {
    const ctx = createContext<number>()
    expect(ctx.defaultValue).toBeUndefined()
  })
})

describe('inject', () => {
  it('returns the default value when no provider', () => {
    const ctx = createContext(42)
    expect(inject(ctx)).toBe(42)
  })

  it('throws when no provider and no default', () => {
    const ctx = createContext<string>()
    expect(() => inject(ctx)).toThrow('[stewie] inject() called with no matching provider and no default value')
  })
})

describe('provide + inject', () => {
  it('returns the provided value inside the callback', () => {
    const ctx = createContext('default')
    let result: string | undefined
    provide(ctx, 'provided', () => {
      result = inject(ctx)
    })
    expect(result).toBe('provided')
  })

  it('nested provide — innermost wins', () => {
    const ctx = createContext('outer')
    let inner: string | undefined
    let outer: string | undefined
    provide(ctx, 'outer', () => {
      outer = inject(ctx)
      provide(ctx, 'inner', () => {
        inner = inject(ctx)
      })
    })
    expect(outer).toBe('outer')
    expect(inner).toBe('inner')
  })

  it('restores previous value after fn completes', () => {
    const ctx = createContext('default')
    provide(ctx, 'provided', () => {
      // inside the provider
    })
    // After the provider, falls back to default
    expect(inject(ctx)).toBe('default')
  })

  it('restores even if fn throws', () => {
    const ctx = createContext('default')
    try {
      provide(ctx, 'provided', () => {
        throw new Error('oops')
      })
    } catch (_) {
      // expected
    }
    // Should have restored: inject returns default, not throw
    expect(inject(ctx)).toBe('default')
  })

  it('returns value from provide', () => {
    const ctx = createContext(0)
    const result = provide(ctx, 10, () => {
      return inject(ctx) * 2
    })
    expect(result).toBe(20)
  })
})
