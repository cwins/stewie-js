// @vitest-environment happy-dom
/**
 * Hydration integration tests — SSR → hydrate round-trip.
 *
 * Each test exercises the full pipeline:
 *   renderToString() → inject HTML + __STEWIE_STATE__ → hydrate()
 *
 * These tests describe the *observable contract* of hydration from the outside.
 * They currently pass because hydrate() remounts and produces the correct
 * end-state. Once true DOM-reuse hydration is implemented, additional
 * assertions (MutationObserver counts, node identity) will be layered on top.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  jsx,
  signal,
  computed,
  createRoot,
  Show,
  For,
} from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'
import { hydrate } from '@stewie-js/core'
import { renderToString } from './renderer.js'
import { useHydrationRegistry } from './hydration.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse window.__STEWIE_STATE__ JSON out of the emitted stateScript tag. */
function extractState(stateScript: string): Record<string, unknown> {
  const match = stateScript.match(/window\.__STEWIE_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/)
  if (!match) return {}
  try {
    return JSON.parse(match[1])
  } catch {
    return {}
  }
}

/**
 * Full SSR → hydrate round-trip helper.
 *
 * Renders `factory()` to a string, injects the HTML into `container`,
 * sets window.__STEWIE_STATE__, then calls hydrate() with a fresh element
 * from `factory()`. Returns the dispose function from hydrate().
 */
async function ssrThenHydrate(
  factory: () => JSXElement,
  container: HTMLElement,
): Promise<() => void> {
  const { html, stateScript } = await renderToString(factory())
  container.innerHTML = html
  window.__STEWIE_STATE__ = extractState(stateScript)
  let dispose!: () => void
  createRoot(() => {
    dispose = hydrate(factory(), container)
  })
  return dispose
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => { delete window.__STEWIE_STATE__ })
afterEach(() => { delete window.__STEWIE_STATE__ })

// ---------------------------------------------------------------------------
// Basic round-trip
// ---------------------------------------------------------------------------

describe('SSR → hydrate: basic round-trip', () => {
  it('produces correct DOM structure after hydration', async () => {
    const container = document.createElement('div')
    await ssrThenHydrate(
      () => jsx('div', { children: [
        jsx('h1', { children: 'Hello' }),
        jsx('p', { children: 'World' }),
      ]}),
      container,
    )
    expect(container.querySelector('h1')?.textContent).toBe('Hello')
    expect(container.querySelector('p')?.textContent).toBe('World')
  })

  it('hydrates without throwing when __STEWIE_STATE__ is absent', async () => {
    const container = document.createElement('div')
    const { html } = await renderToString(jsx('p', { children: 'hello' }))
    container.innerHTML = html
    // Deliberately do not set window.__STEWIE_STATE__
    expect(() => {
      createRoot(() => { hydrate(jsx('p', { children: 'hello' }), container) })
    }).not.toThrow()
    expect(container.querySelector('p')?.textContent).toBe('hello')
  })

  it('hydrates cleanly into an empty container (fresh client mount, no SSR)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const container = document.createElement('div')
    createRoot(() => { hydrate(jsx('div', { children: 'fresh' }), container) })
    expect(container.textContent).toBe('fresh')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('dispose() cleans up after hydration', async () => {
    const container = document.createElement('div')
    const dispose = await ssrThenHydrate(
      () => jsx('p', { children: 'test' }),
      container,
    )
    expect(container.textContent).toBe('test')
    dispose()
    expect(container.textContent).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Hydration state transfer (__STEWIE_STATE__)
// ---------------------------------------------------------------------------

describe('SSR → hydrate: state transfer', () => {
  it('transfers server-set registry values to the client', async () => {
    function StatefulComp(): JSXElement {
      const registry = useHydrationRegistry()
      // Server: writes the value. Client: reads it back via __STEWIE_STATE__.
      if (registry && registry.get('greeting') === undefined) {
        registry.set('greeting', 'hello from server')
      }
      return jsx('div', { children: String(registry?.get('greeting') ?? '') })
    }

    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx(StatefulComp as any, {}), container)
    expect(container.querySelector('div')?.textContent).toBe('hello from server')
  })

  it('stateScript contains __STEWIE_STATE__ outside the HTML fragment', async () => {
    const { html, stateScript } = await renderToString(jsx('div', { children: 'ok' }))
    // State must be in the script tag, not embedded in the HTML fragment
    expect(html).not.toContain('__STEWIE_STATE__')
    expect(stateScript).toContain('window.__STEWIE_STATE__')
  })

  it('multiple registry keys survive the round-trip', async () => {
    function MultiState(): JSXElement {
      const registry = useHydrationRegistry()
      if (registry) {
        if (registry.get('a') === undefined) registry.set('a', 1)
        if (registry.get('b') === undefined) registry.set('b', 2)
      }
      const a = registry?.get('a') as number ?? 0
      const b = registry?.get('b') as number ?? 0
      return jsx('div', { children: String(a + b) })
    }

    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx(MultiState as any, {}), container)
    expect(container.querySelector('div')?.textContent).toBe('3')
  })
})

// ---------------------------------------------------------------------------
// Reactive updates after hydration
// ---------------------------------------------------------------------------

describe('SSR → hydrate: reactive updates', () => {
  it('signal updates reflect in the DOM after hydration', async () => {
    let sig!: ReturnType<typeof signal<number>>

    function Counter(): JSXElement {
      createRoot(() => { sig = signal(0) })
      return jsx('span', { children: sig })
    }

    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx(Counter as any, {}), container)

    expect(container.querySelector('span')?.textContent).toBe('0')
    sig.set(42)
    expect(container.querySelector('span')?.textContent).toBe('42')
  })

  it('computed value updates in the DOM after hydration', async () => {
    let count!: ReturnType<typeof signal<number>>
    let doubled!: ReturnType<typeof computed<number>>

    function DoubleCounter(): JSXElement {
      createRoot(() => {
        count = signal(3)
        doubled = computed(() => count() * 2)
      })
      return jsx('span', { children: doubled })
    }

    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx(DoubleCounter as any, {}), container)
    expect(container.querySelector('span')?.textContent).toBe('6')
    count.set(5)
    expect(container.querySelector('span')?.textContent).toBe('10')
  })

  it('event handlers fire correctly after hydration', async () => {
    let clicked = false

    function ClickTarget(): JSXElement {
      return jsx('button', {
        onClick: () => { clicked = true },
        children: 'click me',
      })
    }

    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx(ClickTarget as any, {}), container)

    container.querySelector('button')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    expect(clicked).toBe(true)
  })

  it('reactive class attribute updates after hydration', async () => {
    let active!: ReturnType<typeof signal<boolean>>

    function Toggler(): JSXElement {
      createRoot(() => { active = signal(false) })
      return jsx('div', { class: () => active() ? 'on' : 'off' })
    }

    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx(Toggler as any, {}), container)

    expect(container.querySelector('div')?.className).toBe('off')
    active.set(true)
    expect(container.querySelector('div')?.className).toBe('on')
  })
})

// ---------------------------------------------------------------------------
// Control flow hydration
// ---------------------------------------------------------------------------

describe('SSR → hydrate: control flow', () => {
  it('Show: renders the truthy branch after hydration', async () => {
    const container = document.createElement('div')
    await ssrThenHydrate(
      () => jsx('div', {
        children: Show({ when: true, children: jsx('span', { children: 'shown' }) }),
      }),
      container,
    )
    expect(container.querySelector('span')?.textContent).toBe('shown')
  })

  it('Show: renders fallback branch after hydration', async () => {
    const container = document.createElement('div')
    await ssrThenHydrate(
      () => jsx('div', {
        children: Show({
          when: false,
          children: jsx('span', { children: 'hidden' }),
          fallback: jsx('span', { children: 'fallback' }),
        }),
      }),
      container,
    )
    expect(container.textContent).toContain('fallback')
    expect(container.textContent).not.toContain('hidden')
  })

  it('Show: toggles correctly when signal changes after hydration', async () => {
    let visible!: ReturnType<typeof signal<boolean>>

    function Conditional(): JSXElement {
      createRoot(() => { visible = signal(true) })
      return jsx('div', {
        children: Show({ when: visible, children: jsx('span', { children: 'yes' }) }),
      })
    }

    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx(Conditional as any, {}), container)

    expect(container.querySelector('span')?.textContent).toBe('yes')
    visible.set(false)
    expect(container.querySelector('span')).toBeNull()
    visible.set(true)
    expect(container.querySelector('span')?.textContent).toBe('yes')
  })

  it('For: renders list items after hydration', async () => {
    const container = document.createElement('div')
    await ssrThenHydrate(
      () => jsx('ul', {
        children: For({
          each: ['alpha', 'beta', 'gamma'],
          children: (item: string) => jsx('li', { children: item }),
        }),
      }),
      container,
    )
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(3)
    expect(items[0].textContent).toBe('alpha')
    expect(items[1].textContent).toBe('beta')
    expect(items[2].textContent).toBe('gamma')
  })

  it('For: list updates after hydration when signal changes', async () => {
    let items!: ReturnType<typeof signal<string[]>>

    function ReactiveList(): JSXElement {
      createRoot(() => { items = signal(['a', 'b']) })
      return jsx('ul', {
        children: For({
          each: items,
          children: (item: string) => jsx('li', { children: item }),
        }),
      })
    }

    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx(ReactiveList as any, {}), container)

    expect(container.querySelectorAll('li')).toHaveLength(2)
    items.set(['a', 'b', 'c'])
    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(container.querySelectorAll('li')[2].textContent).toBe('c')
  })
})

// ---------------------------------------------------------------------------
// Mismatch detection
// ---------------------------------------------------------------------------

describe('SSR → hydrate: mismatch detection', () => {
  it('warns in dev when client output differs from server HTML', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const container = document.createElement('div')

    // Inject server HTML manually with different content than what the client renders
    container.innerHTML = '<p>server text</p>'
    createRoot(() => {
      hydrate(jsx('p', { children: 'client text' }), container)
    })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[stewie] Hydration mismatch'),
      expect.anything(),
      expect.stringContaining('server text'),
    )
    warnSpy.mockRestore()
  })

  it('does not warn when server and client output match', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const container = document.createElement('div')
    await ssrThenHydrate(() => jsx('p', { children: 'consistent' }), container)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
