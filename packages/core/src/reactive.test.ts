import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signal, computed, effect, batch, getCurrentScope, createScope } from './reactive.js'

// ---------------------------------------------------------------------------
// signal
// ---------------------------------------------------------------------------

describe('signal', () => {
  it('read returns initial value', () => {
    const s = signal(42)
    expect(s()).toBe(42)
  })

  it('set updates the value', () => {
    const s = signal(1)
    s.set(2)
    expect(s()).toBe(2)
  })

  it('update applies functional update', () => {
    const s = signal(10)
    s.update(v => v + 5)
    expect(s()).toBe(15)
  })

  it('update receives the current value', () => {
    const s = signal('hello')
    s.update(v => v + ' world')
    expect(s()).toBe('hello world')
  })

  it('notifies a single subscriber on set', () => {
    const s = signal(0)
    let observed = -1
    effect(() => {
      observed = s()
    })
    expect(observed).toBe(0)
    s.set(99)
    expect(observed).toBe(99)
  })

  it('notifies multiple subscribers', () => {
    const s = signal('a')
    const calls: string[] = []
    effect(() => { calls.push('e1:' + s()) })
    effect(() => { calls.push('e2:' + s()) })
    s.set('b')
    expect(calls).toEqual(['e1:a', 'e2:a', 'e1:b', 'e2:b'])
  })

  it('does not notify when value is set to the same value', () => {
    const s = signal(5)
    let count = 0
    effect(() => { s(); count++ })
    expect(count).toBe(1)
    s.set(5)
    expect(count).toBe(1) // no re-run
  })
})

// ---------------------------------------------------------------------------
// computed
// ---------------------------------------------------------------------------

describe('computed', () => {
  it('returns computed value', () => {
    const s = signal(3)
    const c = computed(() => s() * 2)
    expect(c()).toBe(6)
  })

  it('is lazy — fn not called until read', () => {
    const fn = vi.fn(() => 42)
    const c = computed(fn)
    expect(fn).not.toHaveBeenCalled()
    c()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('is memoized — fn not called again if deps unchanged', () => {
    const s = signal(1)
    const fn = vi.fn(() => s() * 2)
    const c = computed(fn)
    c()
    c()
    c()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('re-evaluates when dependency changes', () => {
    const s = signal(4)
    const c = computed(() => s() * 2)
    expect(c()).toBe(8)
    s.set(5)
    expect(c()).toBe(10)
  })

  it('does NOT re-notify downstream if value unchanged (memoized)', () => {
    const s = signal(true)
    // computed always returns same string regardless of s
    const alwaysFoo = computed(() => { s(); return 'foo' })

    let runCount = 0
    effect(() => {
      alwaysFoo()
      runCount++
    })
    expect(runCount).toBe(1)
    s.set(false) // alwaysFoo still returns 'foo' → no downstream notification
    expect(runCount).toBe(1)
  })

  it('auto-tracks multiple dependencies', () => {
    const a = signal(1)
    const b = signal(2)
    const sum = computed(() => a() + b())
    expect(sum()).toBe(3)
    a.set(10)
    expect(sum()).toBe(12)
    b.set(20)
    expect(sum()).toBe(30)
  })

  it('chained computed: A → B → C', () => {
    const a = signal(1)
    const b = computed(() => a() * 2)
    const c = computed(() => b() + 1)
    expect(c()).toBe(3)
    a.set(5)
    expect(b()).toBe(10)
    expect(c()).toBe(11)
  })

  it('chained computed propagates to effect', () => {
    const a = signal(1)
    const b = computed(() => a() * 2)
    const c = computed(() => b() + 10)
    let observed = -1
    effect(() => { observed = c() })
    expect(observed).toBe(12)
    a.set(3)
    expect(observed).toBe(16)
  })
})

// ---------------------------------------------------------------------------
// effect
// ---------------------------------------------------------------------------

describe('effect', () => {
  it('runs immediately on creation', () => {
    let ran = false
    effect(() => { ran = true })
    expect(ran).toBe(true)
  })

  it('re-runs when dependency changes', () => {
    const s = signal(0)
    const values: number[] = []
    effect(() => { values.push(s()) })
    s.set(1)
    s.set(2)
    expect(values).toEqual([0, 1, 2])
  })

  it('cleanup function called before re-run', () => {
    const s = signal(0)
    const log: string[] = []
    // Capture the value at effect run time in a local variable
    // to verify cleanup runs before the next run starts
    effect(() => {
      const current = s()
      log.push(`run:${current}`)
      return () => { log.push(`cleanup:${current}`) }
    })
    s.set(1)
    s.set(2)
    expect(log).toEqual([
      'run:0',
      'cleanup:0',
      'run:1',
      'cleanup:1',
      'run:2',
    ])
  })

  it('cleanup function called on dispose', () => {
    const s = signal(0)
    const log: string[] = []
    const dispose = effect(() => {
      s() // track
      return () => { log.push('cleanup') }
    })
    expect(log).toEqual([])
    dispose()
    expect(log).toEqual(['cleanup'])
  })

  it('dispose prevents re-runs', () => {
    const s = signal(0)
    let count = 0
    const dispose = effect(() => { s(); count++ })
    expect(count).toBe(1)
    dispose()
    s.set(1)
    expect(count).toBe(1) // no re-run after dispose
  })

  it('nested effects track independently', () => {
    const outer = signal('outer')
    const inner = signal('inner')
    const log: string[] = []

    effect(() => {
      log.push(`outer-effect:${outer()}`)
      effect(() => {
        log.push(`inner-effect:${inner()}`)
      })
    })

    expect(log).toEqual(['outer-effect:outer', 'inner-effect:inner'])
    inner.set('inner2')
    expect(log).toContain('inner-effect:inner2')
  })

  it('effect does not re-run when cleanup mutates untracked signal', () => {
    const s = signal(0)
    let count = 0
    effect(() => {
      count++
      s() // track
    })
    expect(count).toBe(1)
    s.set(1)
    expect(count).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// batch
// ---------------------------------------------------------------------------

describe('batch', () => {
  it('groups multiple signal.set() calls — subscriber notified only once', () => {
    const a = signal(0)
    const b = signal(0)
    let count = 0

    effect(() => {
      a(); b()
      count++
    })

    expect(count).toBe(1)

    batch(() => {
      a.set(1)
      b.set(2)
    })

    // Should have been called exactly once after the batch (total = 2)
    expect(count).toBe(2)
  })

  it('batch defers notifications until fn completes', () => {
    const s = signal(0)
    const observed: number[] = []

    effect(() => {
      observed.push(s())
    })

    batch(() => {
      s.set(1)
      expect(observed).toEqual([0]) // not yet notified
      s.set(2)
      expect(observed).toEqual([0]) // still not notified
    })

    expect(observed).toEqual([0, 2]) // notified once after batch with final value
  })

  it('nested batch: notifies only after outermost batch', () => {
    const s = signal(0)
    let count = 0

    effect(() => { s(); count++ })
    expect(count).toBe(1)

    batch(() => {
      batch(() => {
        s.set(1)
        expect(count).toBe(1) // still inside batch
      })
      expect(count).toBe(1) // still inside outer batch
      s.set(2)
    })

    expect(count).toBe(2) // exactly one notification after all batches complete
  })

  it('batch works with computed', () => {
    const a = signal(1)
    const b = signal(2)
    const sum = computed(() => a() + b())
    const results: number[] = []

    effect(() => { results.push(sum()) })

    batch(() => {
      a.set(10)
      b.set(20)
    })

    expect(results).toEqual([3, 30])
  })
})

// ---------------------------------------------------------------------------
// createScope
// ---------------------------------------------------------------------------

describe('createScope', () => {
  it('returns dependencies accessed during fn', () => {
    const s = signal(1)
    let deps!: Set<unknown>

    computed(() => {
      const scope = createScope(() => {
        s() // access signal inside scope
      })
      deps = scope.dependencies
      return 0
    })()

    expect(deps.size).toBe(1)
  })
})
