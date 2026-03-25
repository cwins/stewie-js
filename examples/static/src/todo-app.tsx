// todo-app.tsx — client-side reactive todo list
//
// Demonstrates the full client-side rendering stack:
//
//   signal()      reactive state (todos list, input text, active filter)
//   computed()    derived state (filtered list, remaining/total counts)
//   mount()       renders the JSX tree into a real DOM container
//   For           renders a reactive list; re-renders items when the list changes
//   Show          conditional rendering (empty state vs list)
//   Switch/Match  multi-branch conditional (status message)
//   reactive props  function values as props create fine-grained effect subscriptions
//                   (filter button classes update without re-rendering the whole list)
//   event handlers  onClick / onInput wire DOM events to signal mutations

import { signal, computed, createRoot } from '@stewie-js/core'
import { mount } from '@stewie-js/core'
import { For, Show, Switch, Match } from '@stewie-js/core'
import type { JSXElement, Disposer } from '@stewie-js/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Filter = 'all' | 'active' | 'done'

interface Todo {
  id: number
  text: string
  done: boolean
}

// ---------------------------------------------------------------------------
// TodoApp component
//
// Signals are created inside this function. renderElement() calls component
// functions inside createRoot(), so signal()/computed() here are safe —
// they're always in a reactive scope, never at module level.
// ---------------------------------------------------------------------------

function TodoApp(): JSXElement {
  let nextId = 1
  const todos = signal<Todo[]>([])
  const inputText = signal('')
  const filter = signal<Filter>('all')

  // Derived: the subset of todos matching the active filter
  const filtered = computed<Todo[]>(() => {
    const f = filter()
    const list = todos()
    if (f === 'active') return list.filter((t) => !t.done)
    if (f === 'done') return list.filter((t) => t.done)
    return list
  })

  // Derived counts — read by reactive children/class props
  const remaining = computed(() => todos().filter((t) => !t.done).length)
  const total = computed(() => todos().length)

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  function addTodo(): void {
    const text = inputText().trim()
    if (!text) return
    todos.update((list) => [...list, { id: nextId++, text, done: false }])
    inputText.set('')
  }

  function toggleTodo(id: number): void {
    todos.update((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function removeTodo(id: number): void {
    todos.update((list) => list.filter((t) => t.id !== id))
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div class="todo-app" data-testid="todo-app">
      <h1>Stewie Todos</h1>

      {/* ── Input row ──────────────────────────────────────────────────────── */}
      <div class="add-row">
        <input
          data-testid="todo-input"
          // Reactive prop: effect keeps DOM value in sync with signal
          value={inputText}
          onInput={(e: Event) => inputText.set((e.target as HTMLInputElement).value)}
          placeholder="What needs to be done?"
        />
        <button data-testid="add-btn" onClick={addTodo}>Add</button>
      </div>

      {/* ── Empty state OR main section ────────────────────────────────────── */}
      {/*
        Show re-evaluates `when` reactively. When total() transitions from
        0→1 the list section mounts; when it returns to 0 it unmounts and
        the fallback mounts. No sibling elements are touched.
      */}
      <Show
        when={() => total() > 0}
        fallback={<p data-testid="empty-msg">No todos yet. Add one above!</p>}
      >
        <section data-testid="main-section">
          {/* ── Status message (Switch / Match) ───────────────────────────── */}
          {/*
            Switch evaluates each Match branch and renders the first truthy one.
            Both `when` values are reactive functions so the Switch re-evaluates
            whenever `remaining` or `total` changes.
          */}
          <Switch>
            <Match when={() => remaining() === 0}>
              <p data-testid="status-msg" class="all-done">All done!</p>
            </Match>
            <Match when={() => remaining() > 0}>
              <p data-testid="status-msg">
                {/* Reactive child: text updates in-place without re-mounting */}
                {() => `${remaining()} of ${total()} left`}
              </p>
            </Match>
          </Switch>

          {/* ── Todo list (For) ──────────────────────────────────────────── */}
          {/*
            For subscribes to `filtered` (a computed signal). When the list
            changes (add / remove / toggle / filter switch) For disposes all
            current items and re-renders the new set.
          */}
          <ul data-testid="todo-list">
            <For each={filtered}>
              {(todo: Todo) => (
                <li
                  data-testid={`item-${todo.id}`}
                  // Static per render — For recreates items when list changes,
                  // so this is always correct without needing a reactive function.
                  class={todo.done ? 'done' : 'pending'}
                >
                  <span data-testid={`text-${todo.id}`}>{todo.text}</span>
                  <button
                    data-testid={`toggle-${todo.id}`}
                    onClick={() => toggleTodo(todo.id)}
                  >
                    {todo.done ? 'Undo' : 'Done'}
                  </button>
                  <button
                    data-testid={`remove-${todo.id}`}
                    onClick={() => removeTodo(todo.id)}
                  >
                    ×
                  </button>
                </li>
              )}
            </For>
          </ul>

          {/* ── Filter buttons ────────────────────────────────────────────── */}
          {/*
            Each button's `class` is a reactive function that reads `filter()`.
            When filter changes, ONLY the class attributes update — no re-render
            of the list, no re-mount of any other node. This is fine-grained
            reactivity: the DOM effect is scoped to exactly one attribute.
          */}
          <div data-testid="filters">
            {(['all', 'active', 'done'] as Filter[]).map((f) => (
              <button
                data-testid={`filter-${f}`}
                class={() => (filter() === f ? 'active-filter' : '')}
                onClick={() => filter.set(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </section>
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// mountTodoApp — public entry point
// ---------------------------------------------------------------------------

/**
 * Mount the todo app into `container`.
 *
 * Wraps mount() in createRoot() so any signals created during mounting
 * are properly scoped. Returns a disposer that unmounts and cleans up
 * all reactive effects.
 */
export function mountTodoApp(container: Element): Disposer {
  let dispose!: Disposer
  createRoot(() => {
    dispose = mount(<TodoApp />, container)
  })
  return dispose
}
