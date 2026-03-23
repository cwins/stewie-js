// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import {
  mount,
  assertSignal,
  assertStore,
  renderToString,
  withContext,
  flushEffects,
} from './index.js'
import {
  jsx,
  signal,
  store,
  createContext,
  inject,
  createRoot,
  effect,
  Show,
} from '@stewie/core'
import type { Component, JSXElement } from '@stewie/core'

// ---------------------------------------------------------------------------
// mount — basic rendering
// ---------------------------------------------------------------------------

describe('mount', () => {
  it('renders a simple element', () => {
    const result = mount(jsx('div', { children: 'Hello World' }))
    expect(result.html).toContain('Hello World')
    result.unmount()
  })

  it('getByText finds element containing text', () => {
    const result = mount(jsx('p', { children: 'Find me' }))
    const el = result.getByText('Find me')
    expect(el.textContent).toContain('Find me')
    result.unmount()
  })

  it('getByText throws if not found', () => {
    const result = mount(jsx('div', { children: 'present' }))
    expect(() => result.getByText('missing')).toThrow()
    result.unmount()
  })

  it('queryByText returns null if not found', () => {
    const result = mount(jsx('div', { children: 'present' }))
    expect(result.queryByText('missing')).toBeNull()
    result.unmount()
  })

  it('getByTestId finds element with data-testid', () => {
    const result = mount(jsx('button', { 'data-testid': 'btn', children: 'OK' }))
    const el = result.getByTestId('btn')
    expect(el.getAttribute('data-testid')).toBe('btn')
    result.unmount()
  })

  it('getByRole finds element by semantic role', () => {
    const result = mount(jsx('button', { children: 'Click' }))
    const el = result.getByRole('button')
    expect(el.tagName).toBe('button')
    result.unmount()
  })

  it('findByText resolves asynchronously', async () => {
    const result = mount(jsx('span', { children: 'async text' }))
    const el = await result.findByText('async text')
    expect(el.textContent).toContain('async text')
    result.unmount()
  })

  it('unmount clears the container', () => {
    const result = mount(jsx('div', { children: 'bye' }))
    result.unmount()
    expect(result.container.innerHTML).toBe('')
  })

  it('container is accessible from MountResult', () => {
    const result = mount(jsx('div', { 'data-testid': 'root', children: 'hi' }))
    expect(result.container.querySelector('[data-testid="root"]')).not.toBeNull()
    result.unmount()
  })
})

// ---------------------------------------------------------------------------
// mount — reactive updates (the key differentiator over SSR-based testing)
// ---------------------------------------------------------------------------

describe('mount — reactive updates', () => {
  it('re-renders when a signal changes', () => {
    let count!: ReturnType<typeof signal<number>>
    createRoot(() => {
      count = signal(0)
    })

    // Pass the signal accessor as a function child — dom-renderer wraps it in effect()
    const result = mount(
      jsx('span', { 'data-testid': 'count', children: () => String(count()) }),
    )
    expect(result.getByTestId('count').textContent).toBe('0')

    // Mutate the signal — the effect re-runs synchronously, DOM updates
    count.set(5)
    expect(result.getByTestId('count').textContent).toBe('5')

    result.unmount()
  })

  it('Show mounts and unmounts based on a signal', () => {
    let visible!: ReturnType<typeof signal<boolean>>
    createRoot(() => {
      visible = signal(true)
    })

    // Pass `when` as a function so Show re-evaluates reactively
    const result = mount(
      jsx('div', {
        children: jsx(Show as unknown as Component, {
          when: () => visible(),
          children: jsx('p', { 'data-testid': 'content', children: 'I am here' }),
        }),
      }),
    )
    expect(result.queryByTestId('content')).not.toBeNull()

    visible.set(false)
    expect(result.queryByTestId('content')).toBeNull()

    visible.set(true)
    expect(result.queryByTestId('content')).not.toBeNull()

    result.unmount()
  })

  it('flushEffects resolves after reactive side-effects settle', async () => {
    let count!: ReturnType<typeof signal<number>>
    const log: number[] = []
    createRoot(() => {
      count = signal(0)
      effect(() => {
        log.push(count())
      })
    })

    count.set(1)
    count.set(2)
    await flushEffects()
    // The effects ran synchronously — log should contain all three values
    expect(log).toEqual([0, 1, 2])
  })
})

// ---------------------------------------------------------------------------
// mount — context injection
// ---------------------------------------------------------------------------

describe('mount — context injection', () => {
  it('provides a context value to the rendered tree', () => {
    const ThemeCtx = createContext<string>('light')

    function ThemeDisplay(): JSXElement {
      const theme = inject(ThemeCtx)
      return jsx('span', { 'data-testid': 'theme', children: theme })
    }

    const result = mount(jsx(ThemeDisplay as unknown as Component, {}), {
      contexts: [{ context: ThemeCtx as unknown as import('@stewie/core').Context<unknown>, value: 'dark' }],
    })

    expect(result.getByTestId('theme').textContent).toBe('dark')
    result.unmount()
  })
})

// ---------------------------------------------------------------------------
// assertSignal
// ---------------------------------------------------------------------------

describe('assertSignal', () => {
  it('passes when value matches', () => {
    let sig!: ReturnType<typeof signal<number>>
    createRoot(() => { sig = signal(42) })
    expect(() => assertSignal(sig, 42)).not.toThrow()
  })

  it('throws when value does not match', () => {
    let sig!: ReturnType<typeof signal<number>>
    createRoot(() => { sig = signal(42) })
    expect(() => assertSignal(sig, 0)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// assertStore
// ---------------------------------------------------------------------------

describe('assertStore', () => {
  it('passes when path value matches', () => {
    let s!: ReturnType<typeof store<{ x: number; nested: { y: number } }>>
    createRoot(() => { s = store({ x: 10, nested: { y: 20 } }) })
    expect(() => assertStore(s, 'x', 10)).not.toThrow()
    expect(() => assertStore(s, 'nested.y', 20)).not.toThrow()
  })

  it('uses deep equality for object comparison', () => {
    let s!: ReturnType<typeof store<{ arr: number[] }>>
    createRoot(() => { s = store({ arr: [1, 2, 3] }) })
    expect(() => assertStore(s, 'arr', [1, 2, 3])).not.toThrow()
    expect(() => assertStore(s, 'arr', [1, 2])).toThrow()
  })

  it('throws when path value does not match', () => {
    let s!: ReturnType<typeof store<{ x: number }>>
    createRoot(() => { s = store({ x: 10 }) })
    expect(() => assertStore(s, 'x', 99)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// renderToString (SSR helper — still available for snapshot tests)
// ---------------------------------------------------------------------------

describe('renderToString (SSR helper)', () => {
  it('returns HTML for a component', async () => {
    const html = await renderToString(jsx('h1', { children: 'Hello' }))
    expect(html).toContain('<h1>Hello</h1>')
  })
})

// ---------------------------------------------------------------------------
// withContext
// ---------------------------------------------------------------------------

describe('withContext', () => {
  it('provides a context value within the callback', () => {
    const ctx = createContext<number>(0)
    let captured = -1
    withContext(ctx, 42, () => {
      captured = inject(ctx)
    })
    expect(captured).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// flushEffects
// ---------------------------------------------------------------------------

describe('flushEffects', () => {
  it('returns a Promise', async () => {
    await expect(flushEffects()).resolves.toBeUndefined()
  })
})
