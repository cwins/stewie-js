import { describe, it, expect } from 'vitest'
import { renderApp } from './app.js'

describe('basic-ssr app', () => {
  it('renders the app title', async () => {
    const html = await renderApp()
    expect(html).toContain('Stewie SSR Demo')
  })

  it('renders todo items', async () => {
    const html = await renderApp()
    expect(html).toContain('Learn Stewie')
    expect(html).toContain('Build something')
    expect(html).toContain('Ship it')
  })

  it('renders the todo list when todos exist', async () => {
    const html = await renderApp()
    expect(html).toContain('data-testid="todo-list"')
  })

  it('renders empty message when no todos', async () => {
    const html = await renderApp({ todos: [] })
    expect(html).toContain('No todos yet!')
  })

  it('renders the count', async () => {
    const html = await renderApp({ count: 99 })
    expect(html).toContain('Count: 99')
  })

  it('renders theme indicator', async () => {
    const html = await renderApp()
    expect(html).toContain('theme-dark')
  })

  it('injects hydration state', async () => {
    const html = await renderApp()
    expect(html).toContain('__STEWIE_STATE__')
    expect(html).toContain('appState')
  })

  it('renders with custom title', async () => {
    const html = await renderApp({ title: 'My Custom App' })
    expect(html).toContain('My Custom App')
  })
})
