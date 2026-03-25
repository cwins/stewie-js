// @vitest-environment happy-dom
//
// Tests for the basic-ssr example.
//
// Three layers are covered:
//   1. SSR output — renderApp() produces correct HTML strings
//   2. Hydration — hydrate() picks up __STEWIE_STATE__ and the App reads it
//   3. Client-side DOM — mount() renders the full tree interactively

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderApp, App } from './app.js'
import type { AppState, Todo } from './app.js'
import { hydrate, mount, jsx, createRoot } from '@stewie/core'
import type { Component, Disposer } from '@stewie/core'

// ---------------------------------------------------------------------------
// SSR: renderApp() output
// ---------------------------------------------------------------------------

describe('renderApp — SSR HTML output', () => {
  it('renders the default title', async () => {
    const { html } = await renderApp()
    expect(html).toContain('Stewie SSR Demo')
  })

  it('renders the author', async () => {
    const { html } = await renderApp()
    expect(html).toContain('By Stewie')
  })

  it('renders with a custom title', async () => {
    const { html } = await renderApp({ title: 'My Custom App' })
    expect(html).toContain('My Custom App')
  })

  it('renders all todo texts', async () => {
    const { html } = await renderApp()
    expect(html).toContain('Learn Stewie signals')
    expect(html).toContain('Build a reactive component')
    expect(html).toContain('Write tests with @stewie/testing')
    expect(html).toContain('Deploy to production')
  })

  it('renders the correct done/pending class on each item', async () => {
    const { html } = await renderApp()
    // Item 2 is done
    expect(html).toMatch(/data-testid="todo-2"[^>]*class="[^"]*done/)
    // Item 1 is pending
    expect(html).toMatch(/data-testid="todo-1"[^>]*class="[^"]*pending/)
  })

  it('renders the theme class from ThemeContext', async () => {
    const { html } = await renderApp()
    expect(html).toContain('theme-dark')
  })

  it('renders priority badges via Switch/Match', async () => {
    const { html } = await renderApp()
    expect(html).toContain('badge-high') // item 1
    expect(html).toContain('badge-normal') // items 2, 3
    expect(html).toContain('badge-low') // item 4
  })

  it('omits ClientOnly content on server', async () => {
    const { html } = await renderApp()
    expect(html).not.toContain('Mark done')
    expect(html).not.toContain('check-btn')
  })

  it('renders the stats block', async () => {
    const { html } = await renderApp()
    expect(html).toContain('4 todos')
    expect(html).toContain('1 done')
    expect(html).toContain('1 high priority')
  })

  it('renders the empty state when todos array is empty', async () => {
    const { html } = await renderApp({ todos: [] })
    expect(html).toContain('No todos yet!')
    expect(html).not.toContain('todo-list')
  })

  it('returns stateScript containing __STEWIE_STATE__', async () => {
    const { html, stateScript } = await renderApp()
    expect(html).not.toContain('__STEWIE_STATE__')
    expect(stateScript).toContain('__STEWIE_STATE__')
    expect(stateScript).toContain('appState')
    expect(stateScript).toContain('Learn Stewie signals')
  })

  it('renders with a custom todo list', async () => {
    const todos: Todo[] = [{ id: 1, text: 'Custom task', priority: 'high', done: false }]
    const { html } = await renderApp({ todos })
    expect(html).toContain('Custom task')
    expect(html).toContain('badge-high')
  })
})

// ---------------------------------------------------------------------------
// Client-side: mount() renders the tree into a real DOM
// ---------------------------------------------------------------------------

describe('App — client-side DOM rendering (mount)', () => {
  let container: HTMLDivElement
  let dispose: Disposer

  beforeEach(() => {
    container = document.createElement('div')
    createRoot(() => {
      dispose = mount(jsx(App as unknown as Component, {}), container)
    })
  })

  afterEach(() => {
    dispose()
  })

  it('renders the app container', () => {
    expect(container.querySelector('[data-testid="app"]')).not.toBeNull()
  })

  it('shows the empty state when there are no todos (default registry = empty)', () => {
    // No __STEWIE_STATE__ set — App falls back to the empty default
    expect(container.querySelector('[data-testid="empty-state"]')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Hydration: hydrate() reads window.__STEWIE_STATE__ and App sees it
// ---------------------------------------------------------------------------

describe('App — hydration from __STEWIE_STATE__', () => {
  let container: HTMLDivElement
  let dispose: Disposer

  const serverState: AppState = {
    title: 'Hydrated App',
    author: 'Server',
    todos: [
      { id: 10, text: 'From server', priority: 'high', done: false },
      { id: 11, text: 'Also from server', priority: 'low', done: true },
    ],
  }

  beforeEach(() => {
    window.__STEWIE_STATE__ = { appState: serverState }
    container = document.createElement('div')
    dispose = hydrate(jsx(App as unknown as Component, {}), container)
  })

  afterEach(() => {
    dispose()
    delete window.__STEWIE_STATE__
  })

  it('renders the server-provided title', () => {
    expect(container.querySelector('[data-testid="app-title"]')!.textContent).toBe('Hydrated App')
  })

  it('renders todos from __STEWIE_STATE__', () => {
    expect(container.querySelector('[data-testid="todo-10"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="todo-text-10"]')!.textContent).toBe('From server')
  })

  it('renders ClientOnly content after hydration (client-side)', () => {
    // On the client, ClientOnly renders its children
    expect(container.querySelector('[data-testid="todo-check-10"]')).not.toBeNull()
  })

  it('renders the correct done class from hydrated state', () => {
    const item11 = container.querySelector('[data-testid="todo-11"]')
    expect(item11!.classList.contains('done')).toBe(true)
  })

  it('renders priority badges from hydrated todos', () => {
    expect(container.querySelector('.badge-high')).not.toBeNull()
    expect(container.querySelector('.badge-low')).not.toBeNull()
  })

  it('renders the stats with hydrated data', () => {
    expect(container.querySelector('[data-testid="stat-total"]')!.textContent).toBe('2 todos')
    expect(container.querySelector('[data-testid="stat-done"]')!.textContent).toBe('1 done')
  })

  it('dispose clears the container', () => {
    dispose()
    expect(container.innerHTML).toBe('')
    dispose = () => {} // prevent double-dispose in afterEach
  })
})
