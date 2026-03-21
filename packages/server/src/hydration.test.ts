import { describe, it, expect } from 'vitest'
import { createHydrationRegistry } from './hydration.js'

describe('HydrationRegistry', () => {
  it('stores and retrieves values', () => {
    const reg = createHydrationRegistry()
    reg.set('foo', { bar: 1 })
    expect(reg.get('foo')).toEqual({ bar: 1 })
  })

  it('serializes to JSON', () => {
    const reg = createHydrationRegistry()
    reg.set('count', 42)
    const json = JSON.parse(reg.serialize())
    expect(json.count).toBe(42)
  })
})
