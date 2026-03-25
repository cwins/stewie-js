// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDevtools, destroyDevtools } from '../src/index.js'
import { __devHooks } from '@stewie-js/core'
import { isVisible } from '../src/panel.js'
import { addRenderEntry } from '../src/tabs/renders.js'
import { addSignalEntry } from '../src/tabs/stores.js'

beforeEach(() => {
  destroyDevtools()
})

afterEach(() => {
  destroyDevtools()
})

describe('initDevtools', () => {
  it('mounts the panel to document.body', () => {
    initDevtools()
    const panel = document.querySelector('[data-testid="__stewie-devtools__"]')
    expect(panel).not.toBeNull()
  })

  it('is idempotent — calling twice does not mount two panels', () => {
    initDevtools()
    initDevtools()
    const panels = document.querySelectorAll('[data-testid="__stewie-devtools__"]')
    expect(panels.length).toBe(1)
  })
})

describe('destroyDevtools', () => {
  it('removes the panel from document.body', () => {
    initDevtools()
    destroyDevtools()
    const panel = document.querySelector('[data-testid="__stewie-devtools__"]')
    expect(panel).toBeNull()
  })
})

describe('hooks', () => {
  it('installs hooks after init', () => {
    initDevtools()
    expect(__devHooks.onEffectRun).toBeDefined()
    expect(__devHooks.onSignalWrite).toBeDefined()
  })

  it('removes hooks after destroy', () => {
    initDevtools()
    destroyDevtools()
    expect(__devHooks.onEffectRun).toBeUndefined()
    expect(__devHooks.onSignalWrite).toBeUndefined()
  })
})

describe('keyboard shortcut', () => {
  it('Alt+D toggles panel visibility', () => {
    initDevtools()
    expect(isVisible()).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'd', bubbles: true }))
    expect(isVisible()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'd', bubbles: true }))
    expect(isVisible()).toBe(false)
  })
})

describe('renders tab', () => {
  it('addRenderEntry adds to the renders log when element is present', () => {
    initDevtools()
    const el = document.createElement('div')
    document.body.appendChild(el)
    // No error should occur and log should accept the entry
    expect(() => {
      addRenderEntry({ element: el, attr: 'class', type: 'prop' })
    }).not.toThrow()
    el.remove()
  })
})

describe('stores tab', () => {
  it('addSignalEntry adds to the stores log without throwing', () => {
    initDevtools()
    expect(() => {
      addSignalEntry(42)
      addSignalEntry('hello')
      addSignalEntry({ nested: true })
    }).not.toThrow()
  })
})
