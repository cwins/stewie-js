// @vitest-environment happy-dom
// Tests for the DOM JSX runtime (@stewie/core/dom/jsx-runtime).
// We call jsx() / mount() directly — no TSX compilation needed.

import { describe, it, expect } from 'vitest'
import { jsx, jsxs, Fragment, mount } from './jsx-runtime.js'
import { signal, createRoot } from '../reactive.js'
import { Show, For } from '../components.js'
import type { JSXElement } from '../jsx-runtime.js'

// In the DOM runtime, jsx() returns Node, not JSXElement.
// When passing DOM nodes to descriptor-based control flow (Show/For) we cast.
function asJSX(n: Node): JSXElement {
  return n as unknown as JSXElement
}

function container(): HTMLDivElement {
  return document.createElement('div')
}

function sig<T>(v: T) {
  let s!: ReturnType<typeof signal<T>>
  createRoot(() => {
    s = signal(v)
  })
  return s
}

// ---------------------------------------------------------------------------
// jsx() — creates real DOM nodes
// ---------------------------------------------------------------------------

describe('dom jsx() — creates real DOM nodes', () => {
  it('returns an Element for a string tag', () => {
    const el = jsx('div', {})
    expect(el).toBeInstanceOf(Element)
    expect((el as Element).tagName).toBe('DIV')
  })

  it('sets static class attribute', () => {
    const el = jsx('p', { class: 'foo' }) as Element
    expect(el.getAttribute('class')).toBe('foo')
  })

  it('appends a string child', () => {
    const el = jsx('p', { children: 'hello' }) as Element
    expect(el.textContent).toBe('hello')
  })

  it('appends a number child', () => {
    const el = jsx('span', { children: 42 }) as Element
    expect(el.textContent).toBe('42')
  })

  it('appends an element child', () => {
    const child = jsx('span', { children: 'inner' })
    const parent = jsx('div', { children: child }) as Element
    expect(parent.querySelector('span')?.textContent).toBe('inner')
  })

  it('appends array children', () => {
    const el = jsx('ul', {
      children: [jsx('li', { children: 'a' }), jsx('li', { children: 'b' })],
    }) as Element
    expect(el.querySelectorAll('li').length).toBe(2)
  })

  it('handles Fragment', () => {
    // Fragment returns a DocumentFragment
    const frag = jsx(Fragment, {
      children: [jsx('span', { children: 'x' }), jsx('span', { children: 'y' })],
    })
    expect(frag).toBeInstanceOf(DocumentFragment)
    expect((frag as DocumentFragment).childNodes.length).toBe(2)
  })

  it('jsxs is identical to jsx', () => {
    const a = jsx('div', { class: 'a', children: 'text' }) as Element
    const b = jsxs('div', { class: 'a', children: 'text' }) as Element
    expect(a.outerHTML).toBe(b.outerHTML)
  })
})

// ---------------------------------------------------------------------------
// DOM runtime — reactive props
// ---------------------------------------------------------------------------

describe('dom jsx() — reactive props', () => {
  it('updates class reactively when signal changes', () => {
    const cls = sig('initial')
    const c = container()
    mount(() => jsx('p', { class: cls }), c)
    expect(c.firstElementChild?.getAttribute('class')).toBe('initial')
    cls.set('updated')
    expect(c.firstElementChild?.getAttribute('class')).toBe('updated')
  })

  it('updates text child reactively', () => {
    const text = sig('hello')
    const c = container()
    mount(() => jsx('p', { children: text }), c)
    expect(c.textContent).toBe('hello')
    text.set('world')
    expect(c.textContent).toBe('world')
  })
})

// ---------------------------------------------------------------------------
// DOM runtime — components
// ---------------------------------------------------------------------------

describe('dom jsx() — components', () => {
  it('renders a component function', () => {
    function Greeting({ name }: Record<string, unknown>): Node {
      return jsx('p', { children: `Hi, ${name as string}` })
    }
    const c = container()
    mount(() => jsx(Greeting as unknown as JSXElement['type'], { name: 'Stewie' }), c)
    expect(c.textContent).toBe('Hi, Stewie')
  })
})

// ---------------------------------------------------------------------------
// DOM runtime — control flow (Show / For)
// ---------------------------------------------------------------------------

describe('dom jsx() — Show', () => {
  it('renders children when when is truthy', () => {
    const c = container()
    mount(() => Show({ when: true, children: asJSX(jsx('p', { children: 'visible' })) }), c)
    expect(c.textContent).toBe('visible')
  })

  it('reacts to signal changes', () => {
    const visible = sig(false)
    const c = container()
    mount(
      () =>
        Show({
          when: visible,
          children: asJSX(jsx('p', { children: 'shown' })),
          fallback: asJSX(jsx('p', { children: 'hidden' })),
        }),
      c,
    )
    expect(c.textContent).toBe('hidden')
    visible.set(true)
    expect(c.textContent).toBe('shown')
  })
})

describe('dom jsx() — For', () => {
  it('renders a reactive list', () => {
    const items = sig(['a', 'b'])
    const c = container()
    mount(
      () =>
        For({
          each: items,
          children: (item) => asJSX(jsx('li', { children: item as string })),
        }),
      c,
    )
    expect(c.querySelectorAll('li').length).toBe(2)
    items.set(['a', 'b', 'c'])
    expect(c.querySelectorAll('li').length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// DOM runtime — mount dispose
// ---------------------------------------------------------------------------

describe('dom jsx() — mount dispose', () => {
  it('dispose clears container and stops effects', () => {
    const text = sig('before')
    const c = container()
    const dispose = mount(() => jsx('p', { children: text as unknown as string }), c)
    expect(c.textContent).toBe('before')
    dispose()
    expect(c.textContent).toBe('')
    text.set('after')
    expect(c.textContent).toBe('')
  })
})
