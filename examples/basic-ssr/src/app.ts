// app.ts — isomorphic App component for the basic-ssr example
//
// This file runs on both server (SSR) and client (hydration).
//
// Server flow (renderApp):
//   1. renderToString(jsx(App, { serverState })) is called.
//   2. renderToString internally creates a HydrationRegistry and provides it.
//   3. App reads serverState from props; writes it into the registry.
//   4. renderToString serialises the registry as window.__STEWIE_STATE__.
//
// Client flow (client.ts):
//   1. hydrate(jsx(App, {}), container) reads window.__STEWIE_STATE__.
//   2. hydrate creates a client registry populated from __STEWIE_STATE__.
//   3. App reads appState from the registry — same data the server serialised.
//   4. No extra network request needed.

import { jsx, store, createContext, provide, inject } from '@stewie/core'
import { Show, For, Switch, Match, ClientOnly, ErrorBoundary } from '@stewie/core'
import { useHydrationRegistry } from '@stewie/core'
import type { Component, JSXElement } from '@stewie/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Todo {
  id: number
  text: string
  priority: 'low' | 'normal' | 'high'
  done: boolean
}

export interface AppState {
  title: string
  author: string
  todos: Todo[]
}

// ---------------------------------------------------------------------------
// Theme context — provide/inject across the component tree
// ---------------------------------------------------------------------------

const ThemeContext = createContext<'light' | 'dark'>('light')

function useTheme(): 'light' | 'dark' {
  return inject(ThemeContext)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Header({ title, author }: { title: string; author: string }): JSXElement {
  const theme = useTheme()
  return jsx('header', {
    class: `header theme-${theme}`,
    'data-testid': 'header',
    children: [
      jsx('h1', { 'data-testid': 'app-title', children: title }),
      jsx('p', {
        'data-testid': 'app-author',
        children: `By ${author} · theme: ${theme}`,
      }),
    ],
  })
}

/** Renders a priority badge using Switch/Match. */
function PriorityBadge({ priority }: { priority: Todo['priority'] }): JSXElement {
  return Switch({
    children: [
      Match({
        when: priority === 'high',
        children: jsx('span', { class: 'badge badge-high', children: '↑ high' }),
      }),
      Match({
        when: priority === 'low',
        children: jsx('span', { class: 'badge badge-low', children: '↓ low' }),
      }),
    ],
    fallback: jsx('span', { class: 'badge badge-normal', children: '→ normal' }),
  })
}

function TodoItem({ todo }: { todo: Todo }): JSXElement {
  return jsx('li', {
    'data-testid': `todo-${todo.id}`,
    class: `todo-item priority-${todo.priority} ${todo.done ? 'done' : 'pending'}`,
    children: [
      jsx('span', {
        'data-testid': `todo-text-${todo.id}`,
        class: 'todo-text',
        children: todo.text,
      }),
      PriorityBadge({ priority: todo.priority }),
      // ClientOnly renders its children only on the client, never during SSR.
      // Use it for interactive elements that require browser APIs.
      ClientOnly({
        children: jsx('button', {
          'data-testid': `todo-check-${todo.id}`,
          class: 'check-btn',
          children: todo.done ? '✓ Done' : 'Mark done',
        }),
      }),
    ],
  })
}

function EmptyState(): JSXElement {
  return jsx('div', {
    'data-testid': 'empty-state',
    class: 'empty-state',
    children: [
      jsx('p', { children: 'No todos yet!' }),
      jsx('p', { class: 'hint', children: 'Add some from the server or client.' }),
    ],
  })
}

function Stats({ todos }: { todos: Todo[] }): JSXElement {
  const total = todos.length
  const done = todos.filter((t) => t.done).length
  const high = todos.filter((t) => t.priority === 'high').length

  return jsx('div', {
    'data-testid': 'stats',
    class: 'stats',
    children: [
      jsx('span', { 'data-testid': 'stat-total', children: `${total} todos` }),
      jsx('span', { 'data-testid': 'stat-done', children: `${done} done` }),
      Show({
        when: high > 0,
        children: jsx('span', {
          'data-testid': 'stat-high',
          class: 'high-priority-count',
          children: `${high} high priority`,
        }),
      }),
    ],
  })
}

// ---------------------------------------------------------------------------
// App — root component
// ---------------------------------------------------------------------------

const defaultState: AppState = {
  title: 'Stewie SSR Demo',
  author: 'Stewie',
  todos: [],
}

export function App({ serverState }: { serverState?: AppState } = {}): JSXElement {
  const registry = useHydrationRegistry()

  // Resolution order:
  //   1. Client: registry already has appState from window.__STEWIE_STATE__
  //   2. Server: serverState prop was passed by renderApp()
  //   3. Fallback: empty defaults (e.g. mount() called directly in tests)
  const state: AppState =
    (registry?.get('appState') as AppState | undefined) ?? serverState ?? defaultState

  // Persist into the registry so renderToString() serialises it.
  // On the client the registry is read-only (data already came from the server),
  // but writing is harmless — it just overwrites with the same value.
  registry?.set('appState', state)

  // Wrap in a reactive store for fine-grained subscriptions on the client.
  // Each component subscribes only to the store paths it reads (e.g. store.title
  // changing does NOT invalidate components that only read store.todos).
  const appStore = store({ ...state, todos: [...state.todos] })

  return provide(ThemeContext, 'dark', () =>
    jsx('div', {
      class: 'app',
      'data-testid': 'app',
      children: [
        Header({ title: appStore.title, author: appStore.author }),

        jsx('main', {
          'data-testid': 'main',
          children: [
            ErrorBoundary({
              fallback: (err) =>
                jsx('p', {
                  'data-testid': 'error-msg',
                  class: 'error',
                  children: `Render error: ${String(err)}`,
                }),
              children: Show({
                when: appStore.todos.length > 0,
                fallback: EmptyState(),
                children: jsx('div', {
                  children: [
                    Stats({ todos: appStore.todos }),
                    jsx('ul', {
                      'data-testid': 'todo-list',
                      class: 'todo-list',
                      children: For({
                        each: appStore.todos,
                        children: (todo: Todo) => TodoItem({ todo }),
                      }),
                    }),
                  ],
                }),
              }),
            }),
          ],
        }),
      ],
    }),
  )
}

// ---------------------------------------------------------------------------
// renderApp — server-side convenience wrapper (used by server.ts and tests)
// ---------------------------------------------------------------------------

import { renderToString } from '@stewie/server'

const defaultTodos: Todo[] = [
  { id: 1, text: 'Learn Stewie signals', priority: 'high', done: false },
  { id: 2, text: 'Build a reactive component', priority: 'normal', done: true },
  { id: 3, text: 'Write tests with @stewie/testing', priority: 'normal', done: false },
  { id: 4, text: 'Deploy to production', priority: 'low', done: false },
]

export async function renderApp(state?: Partial<AppState>): Promise<string> {
  const appState: AppState = {
    title: state?.title ?? 'Stewie SSR Demo',
    author: state?.author ?? 'Stewie',
    todos: state?.todos ?? defaultTodos,
  }

  // Pass serverState as a prop. renderToString provides its own registry via
  // context; App writes appState into it so it gets serialised.
  return renderToString(jsx(App as unknown as Component, { serverState: appState }))
}
