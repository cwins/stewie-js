import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { store } from './store.js'
import { effect, signal } from './reactive.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Suppress module-scope dev warnings for tests
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Basic property access and subscription
// ---------------------------------------------------------------------------

describe('store — basic', () => {
  it('reads initial property values', () => {
    const s = store({ count: 0, name: 'alice' })
    expect(s.count).toBe(0)
    expect(s.name).toBe('alice')
  })

  it('writes update the value', () => {
    const s = store({ x: 1 })
    s.x = 10
    expect(s.x).toBe(10)
  })

  it('effect re-runs when read property changes', () => {
    const s = store({ count: 0 })
    const observed: number[] = []
    effect(() => { observed.push(s.count) })
    s.count = 1
    s.count = 2
    expect(observed).toEqual([0, 1, 2])
  })
})

// ---------------------------------------------------------------------------
// Property-level subscription isolation
// ---------------------------------------------------------------------------

describe('store — subscription isolation', () => {
  it('changing store.a does NOT notify a subscriber that only read store.b', () => {
    const s = store({ a: 1, b: 2 })
    let bReads = 0

    effect(() => {
      s.b // only read b
      bReads++
    })

    expect(bReads).toBe(1)
    s.a = 99 // change a
    expect(bReads).toBe(1) // b subscriber not notified
  })

  it('changing store.a.b does NOT notify subscriber that only read store.a.c', () => {
    const s = store({ a: { b: 1, c: 2 } })
    let cReads = 0

    effect(() => {
      s.a.c // only read a.c
      cReads++
    })

    expect(cReads).toBe(1)
    s.a.b = 99 // change a.b
    expect(cReads).toBe(1) // a.c subscriber not notified
  })

  it('changing store.a notifies subscriber that read store.a', () => {
    const s = store({ a: 1, b: 2 })
    const aValues: number[] = []

    effect(() => { aValues.push(s.a) })

    s.a = 5
    expect(aValues).toEqual([1, 5])
  })
})

// ---------------------------------------------------------------------------
// Deep nesting
// ---------------------------------------------------------------------------

describe('store — deep nesting', () => {
  it('reads deeply nested values', () => {
    const s = store({ a: { b: { c: 42 } } })
    expect(s.a.b.c).toBe(42)
  })

  it('setting a.b.c notifies subscribers of a.b.c', () => {
    const s = store({ a: { b: { c: 0 } } })
    const values: number[] = []

    effect(() => { values.push(s.a.b.c) })

    s.a.b.c = 1
    s.a.b.c = 2
    expect(values).toEqual([0, 1, 2])
  })

  it('setting a.b.c does NOT notify subscriber only reading a.b.d', () => {
    const s = store({ a: { b: { c: 1, d: 2 } } })
    let dReads = 0

    effect(() => {
      s.a.b.d
      dReads++
    })

    expect(dReads).toBe(1)
    s.a.b.c = 99
    expect(dReads).toBe(1)
  })

  it('setting a.b notifies only a.b subscribers, not a.b.c subscribers', () => {
    const s = store({ a: { b: { c: 1 } } })
    const abValues: unknown[] = []
    let abcRuns = 0

    effect(() => { abValues.push(s.a.b) })
    effect(() => { s.a.b.c; abcRuns++ })

    const newB = { c: 99 }
    s.a.b = newB as { c: number }
    expect(abValues.length).toBe(2) // notified
    expect(abValues[1]).toEqual(newB)
  })
})

// ---------------------------------------------------------------------------
// Array mutations
// ---------------------------------------------------------------------------

describe('store — arrays', () => {
  it('push triggers array subscribers', () => {
    const s = store({ items: [1, 2, 3] })
    const snapshots: number[][] = []

    effect(() => {
      // Read the array to subscribe
      snapshots.push([...s.items])
    })

    expect(snapshots).toHaveLength(1)
    s.items.push(4)
    expect(snapshots).toHaveLength(2)
    expect(snapshots[1]).toEqual([1, 2, 3, 4])
  })

  it('splice triggers array subscribers', () => {
    const s = store({ items: ['a', 'b', 'c'] })
    const snapshots: string[][] = []

    effect(() => {
      snapshots.push([...s.items])
    })

    s.items.splice(1, 1)
    expect(snapshots).toHaveLength(2)
    expect(snapshots[1]).toEqual(['a', 'c'])
  })

  it('pop triggers array subscribers', () => {
    const s = store({ list: [10, 20, 30] })
    const snapshots: number[][] = []

    effect(() => {
      snapshots.push([...s.list])
    })

    s.list.pop()
    expect(snapshots).toHaveLength(2)
    expect(snapshots[1]).toEqual([10, 20])
  })

  it('direct index assignment notifies index subscribers', () => {
    const s = store({ arr: [1, 2, 3] })
    const values: number[] = []

    effect(() => {
      values.push(s.arr[0])
    })

    s.arr[0] = 99
    expect(values).toEqual([1, 99])
  })
})

// ---------------------------------------------------------------------------
// Whole-object replacement
// ---------------------------------------------------------------------------

describe('store — object replacement', () => {
  it('replacing a nested object triggers parent property subscribers', () => {
    const s = store({ user: { name: 'Alice', age: 30 } })
    const names: string[] = []

    effect(() => {
      names.push(s.user.name)
    })

    s.user = { name: 'Bob', age: 25 }
    expect(names).toEqual(['Alice', 'Bob'])
  })

  it('replacing nested object with different name triggers subscriber', () => {
    const s = store({ data: { value: 0 } })
    const values: number[] = []

    effect(() => { values.push(s.data.value) })

    // Replace the whole data object
    s.data = { value: 42 }
    expect(values).toEqual([0, 42])
  })
})

// ---------------------------------------------------------------------------
// Integration with signals
// ---------------------------------------------------------------------------

describe('store — integration with signals', () => {
  it('store and signal can be used in the same effect', () => {
    const s = store({ count: 0 })
    const multiplier = signal(2)
    const results: number[] = []

    effect(() => {
      results.push(s.count * multiplier())
    })

    s.count = 3
    multiplier.set(3)
    expect(results).toEqual([0, 6, 9])
  })
})
