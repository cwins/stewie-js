import { describe, it, expect } from 'vitest'
import { mount, assertSignal, assertStore, renderToString, withContext, flushEffects } from './index.js'
import { jsx, signal, store, createContext, inject, _setAllowReactiveCreation } from '@stewie/core'

describe('mount', () => {
  it('renders a simple component to HTML', async () => {
    const result = await mount(jsx('div', { children: 'Hello World' }))
    expect(result.html).toContain('Hello World')
  })

  it('getByText finds element containing text', async () => {
    const result = await mount(jsx('p', { children: 'Find me' }))
    const el = result.getByText('Find me')
    expect(el.textContent).toContain('Find me')
  })

  it('getByText throws if not found', async () => {
    const result = await mount(jsx('div', { children: 'present' }))
    expect(() => result.getByText('missing')).toThrow()
  })

  it('queryByText returns null if not found', async () => {
    const result = await mount(jsx('div', { children: 'present' }))
    expect(result.queryByText('missing')).toBeNull()
  })

  it('getByTestId finds element with data-testid', async () => {
    const result = await mount(jsx('button', { 'data-testid': 'btn', children: 'OK' }))
    const el = result.getByTestId('btn')
    expect(el.getAttribute('data-testid')).toBe('btn')
  })

  it('getByRole finds element by semantic role', async () => {
    const result = await mount(jsx('button', { children: 'Click' }))
    const el = result.getByRole('button')
    expect(el.tagName).toBe('button')
  })

  it('findByText resolves async', async () => {
    const result = await mount(jsx('span', { children: 'async' }))
    const el = await result.findByText('async')
    expect(el.textContent).toContain('async')
  })

  it('unmount does not throw', async () => {
    const result = await mount(jsx('div', { children: 'test' }))
    expect(() => result.unmount()).not.toThrow()
  })
})

describe('assertSignal', () => {
  it('passes when value matches', () => {
    _setAllowReactiveCreation(true)
    const sig = signal(42)
    _setAllowReactiveCreation(false)
    expect(() => assertSignal(sig, 42)).not.toThrow()
  })

  it('throws when value does not match', () => {
    _setAllowReactiveCreation(true)
    const sig = signal(42)
    _setAllowReactiveCreation(false)
    expect(() => assertSignal(sig, 0)).toThrow()
  })
})

describe('assertStore', () => {
  it('passes when path value matches', () => {
    _setAllowReactiveCreation(true)
    const s = store({ x: 10, nested: { y: 20 } })
    _setAllowReactiveCreation(false)
    expect(() => assertStore(s, 'x', 10)).not.toThrow()
    expect(() => assertStore(s, 'nested.y', 20)).not.toThrow()
  })

  it('throws when path value does not match', () => {
    _setAllowReactiveCreation(true)
    const s = store({ x: 10 })
    _setAllowReactiveCreation(false)
    expect(() => assertStore(s, 'x', 99)).toThrow()
  })
})

describe('renderToString (SSR)', () => {
  it('returns HTML for a component', async () => {
    const html = await renderToString(jsx('h1', { children: 'Hello' }))
    expect(html).toContain('<h1>Hello</h1>')
  })
})

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

describe('flushEffects', () => {
  it('does not throw', () => {
    expect(() => flushEffects()).not.toThrow()
  })
})
