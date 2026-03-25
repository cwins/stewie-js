// app.tsx — isomorphic App component for the basic-ssr example
//
// This file runs on both server (SSR) and client (hydration).
//
// Server flow (renderApp):
//   1. renderToString(<App serverState={...} />) is called.
//   2. renderToString internally creates a HydrationRegistry and provides it.
//   3. App reads serverState from props; writes it into the registry.
//   4. renderToString serialises the registry as window.__STEWIE_STATE__.
//
// Client flow (client.tsx):
//   1. hydrate(<App />, container) reads window.__STEWIE_STATE__.
//   2. hydrate creates a client registry populated from __STEWIE_STATE__.
//   3. App reads appState from the registry — same data the server serialised.
//   4. No extra network request needed.

import { store, createContext, inject } from '@stewie-js/core'
import { Show, For, Switch, Match, ClientOnly, ErrorBoundary } from '@stewie-js/core'
import { useHydrationRegistry } from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'

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
  return (
    <header class={`header theme-${theme}`} data-testid="header">
      <h1 data-testid="app-title">{title}</h1>
      <p data-testid="app-author">{`By ${author} · theme: ${theme}`}</p>
    </header>
  )
}

/** Renders a priority badge using Switch/Match. */
function PriorityBadge({ priority }: { priority: Todo['priority'] }): JSXElement {
  return (
    <Switch fallback={<span class="badge badge-normal">→ normal</span>}>
      <Match when={priority === 'high'}>
        <span class="badge badge-high">↑ high</span>
      </Match>
      <Match when={priority === 'low'}>
        <span class="badge badge-low">↓ low</span>
      </Match>
    </Switch>
  )
}

function TodoItem({ todo }: { todo: Todo }): JSXElement {
  return (
    <li
      data-testid={`todo-${todo.id}`}
      class={`todo-item priority-${todo.priority} ${todo.done ? 'done' : 'pending'}`}
    >
      <span data-testid={`todo-text-${todo.id}`} class="todo-text">
        {todo.text}
      </span>
      <PriorityBadge priority={todo.priority} />
      {/* ClientOnly renders its children only on the client, never during SSR.
          Use it for interactive elements that require browser APIs. */}
      <ClientOnly>
        <button data-testid={`todo-check-${todo.id}`} class="check-btn">
          {todo.done ? '✓ Done' : 'Mark done'}
        </button>
      </ClientOnly>
    </li>
  )
}

function EmptyState(): JSXElement {
  return (
    <div data-testid="empty-state" class="empty-state">
      <p>No todos yet!</p>
      <p class="hint">Add some from the server or client.</p>
    </div>
  )
}

function Stats({ todos }: { todos: Todo[] }): JSXElement {
  const total = todos.length
  const done = todos.filter((t) => t.done).length
  const high = todos.filter((t) => t.priority === 'high').length

  return (
    <div data-testid="stats" class="stats">
      <span data-testid="stat-total">{`${total} todos`}</span>
      <span data-testid="stat-done">{`${done} done`}</span>
      <Show when={high > 0}>
        <span data-testid="stat-high" class="high-priority-count">
          {`${high} high priority`}
        </span>
      </Show>
    </div>
  )
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

  return (
    <ThemeContext.Provider value="dark">
      <div class="app" data-testid="app">
        <Header title={appStore.title} author={appStore.author} />

        <main data-testid="main">
          <ErrorBoundary
            fallback={(err) => (
              <p data-testid="error-msg" class="error">
                {`Render error: ${String(err)}`}
              </p>
            )}
          >
            <Show when={appStore.todos.length > 0} fallback={<EmptyState />}>
              <div>
                <Stats todos={appStore.todos} />
                <ul data-testid="todo-list" class="todo-list">
                  <For each={appStore.todos}>
                    {(todo: Todo) => <TodoItem todo={todo} />}
                  </For>
                </ul>
              </div>
            </Show>
          </ErrorBoundary>
        </main>
      </div>
    </ThemeContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// renderApp — server-side convenience wrapper (used by server.ts and tests)
// ---------------------------------------------------------------------------

import { renderToString } from '@stewie-js/server'
import type { RenderResult } from '@stewie-js/server'

const defaultTodos: Todo[] = [
  { id: 1, text: 'Learn Stewie signals', priority: 'high', done: false },
  { id: 2, text: 'Build a reactive component', priority: 'normal', done: true },
  { id: 3, text: 'Write tests with @stewie-js/testing', priority: 'normal', done: false },
  { id: 4, text: 'Deploy to production', priority: 'low', done: false },
]

export async function renderApp(state?: Partial<AppState>): Promise<RenderResult> {
  const appState: AppState = {
    title: state?.title ?? 'Stewie SSR Demo',
    author: state?.author ?? 'Stewie',
    todos: state?.todos ?? defaultTodos,
  }

  // Pass serverState as a prop. renderToString provides its own registry via
  // context; App writes appState into it so it gets serialised.
  return renderToString(<App serverState={appState} />)
}
