# Reactivity

Stewie's reactivity model is fine-grained: each reactive value knows exactly which parts of the UI depend on it and updates only those parts. There is no virtual DOM, no component re-render cycle, and no reconciliation pass.

---

## Signals

A signal is the fundamental reactive primitive — a value that notifies subscribers when it changes.

```ts
const count = signal(0)

count()           // read — returns 0
count.set(5)      // write — notifies subscribers
count.update(n => n + 1)  // functional update
count.peek()      // read without subscribing
```

Signals can hold any value: primitives, objects, arrays, or `null`.

The key rule: **signals must be created inside a component or `createRoot()`**, not at module scope. In dev mode, creating a signal at module scope logs a warning.

---

## Computed values

`computed` derives a value from other reactive values. It is lazy (only evaluates when read) and memoized (only notifies downstream when the result actually changes).

```ts
const count = signal(3)
const doubled = computed(() => count() * 2)

doubled()  // 6
count.set(4)
doubled()  // 8 — recomputed because count changed
```

A computed value tracks its dependencies automatically. When `count` changes, `doubled` recomputes. If the new result is the same value (strict equality), it does not notify its own subscribers — the update stops there.

Computed values can depend on other computed values:

```ts
const total = computed(() => price() * quantity())
const withTax = computed(() => total() * 1.2)
```

---

## Effects

`effect` runs a function immediately and re-runs it whenever any reactive value it read changes.

```ts
const dispose = effect(() => {
  console.log('count is now', count())
})
```

Effects are for side effects: updating the DOM manually, syncing to localStorage, starting timers, etc. The Stewie renderer uses effects internally for reactive JSX — you rarely need to write effects in component code.

**Cleanup:** if `fn` returns a function, it is called before the next run and when the effect is disposed:

```ts
effect(() => {
  const id = setInterval(() => tick.update(n => n + 1), 1000)
  return () => clearInterval(id)
})
```

**Disposing:** the return value of `effect()` is a dispose function:

```ts
const stop = effect(() => { ... })
stop()  // unsubscribes, runs cleanup
```

---

## `batch`

When multiple signals change together, `batch` defers all notifications until the callback completes. This prevents intermediate states from triggering effects.

```ts
batch(() => {
  firstName.set('Jane')
  lastName.set('Smith')
})
// effects run once, seeing both changes
```

---

## `untrack`

`untrack` reads reactive values without registering a subscription in the current tracking scope.

```ts
effect(() => {
  // subscribes to 'a', but not 'b'
  const result = a() + untrack(() => b())
  doSomethingWith(result)
})
```

---

## Store

`store` wraps an object (or array of objects) in a reactive proxy. It is the right tool when you have structured state with multiple interconnected properties.

```ts
const state = store({
  user: { name: 'Alice', role: 'admin' },
  todos: [] as { id: number; text: string; done: boolean }[]
})
```

Reading a property inside a reactive context registers a subscription to that exact path:

```ts
effect(() => {
  // only re-runs if state.user.name changes
  // not triggered by state.user.role or state.todos
  console.log(state.user.name)
})
```

Writing a property notifies only subscribers of that path:

```ts
state.user.name = 'Bob'      // notifies user.name subscribers only
state.todos.push({ ... })    // notifies todos subscribers
```

Array mutation methods (`push`, `pop`, `splice`, `sort`, etc.) are all intercepted and trigger the appropriate notifications.

### Store vs signal

Use **`signal`** for a single value that changes as a unit:

```ts
const isOpen = signal(false)
const selectedId = signal<string | null>(null)
```

Use **`store`** for structured objects where you want path-level subscriptions — components that read only `state.user.name` should not update when `state.todos` changes:

```ts
const app = store({
  user: { name: '', role: '' },
  todos: []
})
```

---

## Subscription model

When a reactive expression (JSX attribute, computed function, or effect body) runs, Stewie pushes a tracking scope onto a stack. Every signal or store property read during execution registers itself with that scope. When the value changes, it notifies the scope, which re-runs the expression.

This means subscriptions are:
- **automatic** — you don't declare dependencies
- **exact** — only the values actually read during a run are tracked
- **dynamic** — if a conditional branch means a value isn't read, it isn't tracked

```ts
const showExtra = signal(false)
const extra = signal('hello')

effect(() => {
  if (showExtra()) {
    // extra is only subscribed when showExtra() is true
    console.log(extra())
  }
})
```

---

## Further reading

- [`signal`, `computed`, `effect`, `batch`, `untrack`](../reference/core-api.md#reactivity) — full API reference
- [`store`](../reference/core-api.md#store) — store API reference
- [Derived Collections from Store State](../patterns/derived-collections.md) — a common gotcha when filtering store arrays
