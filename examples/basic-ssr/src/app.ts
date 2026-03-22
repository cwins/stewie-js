import { jsx, createContext, provide, inject } from '@stewie/core'
import { Show } from '@stewie/core'
import { renderToString, useHydrationRegistry } from '@stewie/server'

// A sample "todo" app component that demonstrates:
// - signals and stores
// - context
// - Show and For control flow
// - SSR rendering

// Theme context
const ThemeContext = createContext<'light' | 'dark'>('light')

function ThemeIndicator() {
  const theme = inject(ThemeContext)
  return jsx('span', { class: `theme-${theme}`, children: `Theme: ${theme}` })
}

interface Todo {
  id: number
  text: string
  done: boolean
}

interface AppState {
  title: string
  todos: Todo[]
  count: number
}

function TodoItem({ todo }: { todo: Todo }) {
  return jsx('li', {
    class: todo.done ? 'done' : 'pending',
    'data-testid': `todo-${todo.id}`,
    children: todo.text,
  })
}

function TodoList({ todos }: { todos: Todo[] }) {
  return jsx('ul', {
    'data-testid': 'todo-list',
    children: todos.map((todo) => TodoItem({ todo })),
  })
}

function App({ state }: { state: AppState }) {
  // Register app state in the hydration registry so it's serialized into the page
  const registry = useHydrationRegistry()
  if (registry) {
    registry.set('appState', state)
  }

  return provide(ThemeContext, 'dark', () =>
    jsx('div', {
      class: 'app',
      children: [
        jsx('h1', { children: state.title }),
        ThemeIndicator(),
        jsx('p', { children: `Count: ${state.count}` }),
        Show({
          when: state.todos.length > 0,
          fallback: jsx('p', { 'data-testid': 'empty-msg', children: 'No todos yet!' }),
          children: TodoList({ todos: state.todos }),
        }),
      ],
    }),
  )
}

// Export a render function for use in server.ts and tests
export async function renderApp(state?: Partial<AppState>): Promise<string> {
  const appState: AppState = {
    title: state?.title ?? 'Stewie SSR Demo',
    todos: state?.todos ?? [
      { id: 1, text: 'Learn Stewie', done: false },
      { id: 2, text: 'Build something', done: false },
      { id: 3, text: 'Ship it', done: true },
    ],
    count: state?.count ?? 42,
  }

  return renderToString(jsx(App as any, { state: appState }))
}
