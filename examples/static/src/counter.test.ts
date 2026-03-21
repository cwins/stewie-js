import { describe, it, expect } from 'vitest'
import { createCounter } from './counter.js'

describe('createCounter', () => {
  it('starts at the initial value', () => {
    const c = createCounter(5)
    expect(c.count()).toBe(5)
  })

  it('increments', () => {
    const c = createCounter(0)
    c.increment()
    expect(c.count()).toBe(1)
  })

  it('decrements', () => {
    const c = createCounter(10)
    c.decrement()
    expect(c.count()).toBe(9)
  })

  it('resets to initial value', () => {
    const c = createCounter(3)
    c.increment()
    c.increment()
    c.reset()
    expect(c.count()).toBe(3)
  })

  it('computed doubled updates reactively', () => {
    const c = createCounter(4)
    expect(c.doubled()).toBe(8)
    c.increment()
    expect(c.doubled()).toBe(10)
  })
})
