# Core API Reference

`@stewie-js/core` provides the reactive primitives, JSX runtime, context system, control flow components, and DOM renderer that everything else in Stewie builds on.

---

## Reactivity

### `signal<T>(initialValue): Signal<T>`

Creates a reactive value. Reading it inside an `effect` or `computed` registers a subscription; writing it notifies all subscribers.

```ts
const count = signal(0)

count()           // read — returns 0
count.peek()      // read without subscribing
count.set(5)      // write
count.update(n => n + 1)  // functional update
```

**`Signal<T>` interface**

| Member | Description |
|--------|-------------|
| `sig()` | Read the value. Registers a subscription in the current tracking scope. |
| `sig.peek()` | Read without subscribing. |
| `sig.set(value)` | Write a new value. No-op if the value is strictly equal to the current value. |
| `sig.update(fn)` | Write the result of `fn(currentValue)`. |

Signals must be created inside a component or `createRoot()` — not at module scope. In dev mode, creating a signal at module scope logs a warning.

---

### `computed<T>(fn): Computed<T>`

Creates a derived value that re-evaluates when its dependencies change. Memoized — only notifies downstream if the result actually changed (strict equality).

```ts
const doubled = computed(() => count() * 2)
doubled()  // read — subscribes to count
```

`computed` is lazy: `fn` only runs when the value is first read, and again when a dependency changes.

---

### `effect(fn): Dispose`

Runs `fn` immediately and re-runs it whenever any reactive value read inside `fn` changes.

```ts
const dispose = effect(() => {
  document.title = `Count: ${count()}`
})

dispose()  // stop the effect
```

`fn` may return a cleanup function. It is called before the next run and when the effect is disposed.

```ts
effect(() => {
  const id = setInterval(() => tick(), 1000)
  return () => clearInterval(id)  // cleanup
})
```

---

### `batch(fn): void`

Defers all reactive notifications until `fn` completes. Prevents cascading updates when multiple signals change together.

```ts
batch(() => {
  firstName.set('Jane')
  lastName.set('Smith')
})
// effects run once after both are set
```

---

### `untrack<T>(fn): T`

Runs `fn` and returns its result without registering any reactive subscriptions for signal reads inside `fn`.

```ts
effect(() => {
  // subscribes to 'a', but not 'b'
  const result = a() + untrack(() => b())
  console.log(result)
})
```

---

### `onCleanup(fn): void`

Registers a cleanup function that runs when the current reactive root (component) is disposed — i.e., when the component unmounts.

Call inside a component body or inside `createRoot()`. If called outside any root it is silently ignored.

```ts
function DataLoader() {
  const ctrl = new AbortController()
  onCleanup(() => ctrl.abort())

  fetch('/api/data', { signal: ctrl.signal })
    .then(r => r.json())
    .then(data => /* update signals */)
}
```

This is the mechanism `resource()` uses to cancel in-flight requests when a component unmounts.

---

### `getOwner(): Owner | null`

Returns the current reactive ownership scope, or `null` if called outside any `createRoot()`.

Use this together with `runInOwner` to track effects and cleanup functions created in async continuations (after `await`) back to their originating root.

```ts
createRoot(async (dispose) => {
  const owner = getOwner()   // capture before first await
  const data = await loadData()

  runInOwner(owner, () => {
    effect(() => render(data))   // owned — disposed when root disposes
    onCleanup(() => cleanup())   // owned — runs on dispose
  })
})
```

---

### `runInOwner<T>(owner: Owner | null, fn: () => T): T`

Run `fn` with the given ownership scope active. Effects, computed values, and `onCleanup` calls inside `fn` are registered with `owner`'s root and will be disposed when that root is disposed.

If `owner` is `null`, `fn` runs without any owner.

See `getOwner` for the typical usage pattern.

---

### `createRoot<T>(fn): T`

Creates a reactive ownership scope. Effects and computed values created inside `fn` are owned by this root and disposed together when `dispose()` is called.

```ts
const dispose = createRoot(dispose => {
  const count = signal(0)
  effect(() => console.log(count()))
  return dispose
})

dispose()  // stops all effects created inside
```

The `dispose` argument is optional — `createRoot(() => { ... })` is the common form used by the renderer for each component.

---

## Store

### `store<T extends object>(initial): T`

Creates a reactive proxy-wrapped object. Property reads register path-level subscriptions; only the components that read a specific path update when that path changes.

```ts
const state = store({
  user: { name: 'Alice', role: 'admin' },
  todos: [] as string[]
})

state.user.name = 'Bob'       // only subscribers of user.name update
state.todos.push('Buy milk')  // triggers todos subscribers
```

Deep nesting is automatically proxied on access. Array mutation methods (`push`, `pop`, `splice`, `sort`, etc.) trigger notifications on the array and its index paths.

Changing `state.user.name` does **not** notify subscribers of `state.user.role` or `state.todos` — subscriptions are path-level, not object-level.

Like `signal`, `store` must be created inside a component or `createRoot()`.

---

## Context

### `createContext<T>(defaultValue?): Context<T>`

Creates a typed context token. The optional `defaultValue` is returned by `inject()` when no provider is found. Omitting it means `inject()` will throw if called without a matching provider.

```ts
const ThemeContext = createContext<'light' | 'dark'>('light')
```

---

### `provide<T, R>(context, value, fn): R`

Runs `fn` with `value` as the active value for `context`. Returns whatever `fn` returns.

```ts
provide(ThemeContext, 'dark', () => {
  // ThemeContext resolves to 'dark' for everything called inside fn
  renderSubtree()
})
```

---

### `inject<T>(context): T`

Reads the nearest provided value for `context`. Throws if no provider is found and the context has no default value.

```ts
function Button() {
  const theme = inject(ThemeContext)
  return <button class={theme}>Click</button>
}
```

---

### `Context.Provider`

JSX-compatible provider component. Preferred over `provide()` for component trees.

```tsx
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>
```

---

## Control Flow

Control flow components replace conditional and list rendering logic that would otherwise require effects or manual DOM work.

---

### `<Show when children fallback?>`

Conditionally renders `children` when `when` is truthy.

```tsx
<Show when={() => user() !== null} fallback={<p>Loading…</p>}>
  <UserProfile />
</Show>
```

`when` can be a value, a signal, or a getter function `() => T`. The fallback is optional.

When `children` is a function, it is called fresh each time the branch mounts — use this when the children's props depend on reactive values:

```tsx
<Show when={() => data() !== null}>
  {() => <ResultList items={data()!} />}
</Show>
```

See [Reactive Branches and Child Component Props](../patterns/reactive-branches.md) for details on why this matters.

---

### `<For each by? children>`

Keyed list rendering with fine-grained updates. Only the rows affected by a change re-render.

```tsx
<For each={todos} by={(todo) => todo.id}>
  {(getTodo) => (
    <li>{getTodo().text}</li>
  )}
</For>
```

| Prop | Type | Description |
|------|------|-------------|
| `each` | `T[]`, `Signal<T[]>`, or `() => T[]` | The list to render. |
| `by` | `(item: T) => string \| number` | Key function for reconciliation. Highly recommended — without it, the list is unkeyed and all rows re-render on every change. |
| `children` | `(item: () => T, index: () => number) => JSXElement` | Render function. Receives a reactive getter for the item, not the item directly. |

The item getter (`getTodo` above) is reactive — reading it inside the render function subscribes to that specific item. Changing one item's data updates only that row's DOM.

---

### `<Switch fallback?> / <Match when children>`

Multi-branch conditional rendering. Renders the first `<Match>` whose `when` is truthy.

```tsx
<Switch fallback={<p>Unknown state</p>}>
  <Match when={() => status() === 'loading'}>
    <Spinner />
  </Match>
  <Match when={() => status() === 'error'}>
    <ErrorMessage />
  </Match>
  <Match when={() => status() === 'ready'}>
    {() => <DataView data={data()!} />}
  </Match>
</Switch>
```

`children` on `<Match>` can be JSX or a function `(value: T) => JSXElement` that receives the truthy `when` value.

---

### `<Portal target?>`

Renders children into a different DOM node.

```tsx
<Portal target={document.getElementById('modal-root')!}>
  <Modal />
</Portal>
```

`target` defaults to `document.body` if omitted.

---

### `<ErrorBoundary fallback>`

Catches errors thrown during rendering of its children and renders `fallback` instead.

```tsx
<ErrorBoundary fallback={(err) => <p>Error: {String(err)}</p>}>
  <RiskyComponent />
</ErrorBoundary>
```

---

### `<Suspense fallback>`

Shows `fallback` while children are loading. Works with `resource().read()` and async data.

```tsx
<Suspense fallback={<Spinner />}>
  <AsyncComponent />
</Suspense>
```

---

### `<ClientOnly>`

Renders children only on the client. Renders nothing during SSR.

```tsx
<ClientOnly>
  <Map />  {/* safe to use browser APIs here */}
</ClientOnly>
```

---

## Async Data

### `resource<T>(fetcher): Resource<T>`

Wraps an async function and exposes reactive signals for its loading state, data, and error. The fetcher is called immediately.

The fetcher receives an `AbortSignal` that is cancelled automatically in two situations:
- When `refetch()` is called — the previous in-flight request is aborted before the new one starts.
- When the owning component unmounts — the in-flight request is aborted and its result is discarded.

```ts
const users = resource((signal) =>
  fetch('/api/users', { signal }).then(r => r.json())
)
```

**`Resource<T>` interface**

| Member | Description |
|--------|-------------|
| `data` | `Signal<T \| undefined>` — the resolved data, or `undefined` while loading. |
| `loading` | `Signal<boolean>` — true while the fetch is in flight. |
| `error` | `Signal<unknown>` — the thrown error, or `null` if none. |
| `read()` | Suspense-compatible accessor — throws a Promise while loading, throws the error on failure, returns data when ready. |
| `refetch()` | Abort the current fetch, then re-invoke the fetcher. Returns a Promise that resolves when the new fetch completes. |

**DOM usage (recommended):**

```tsx
function UserList() {
  const users = resource((signal) =>
    fetch('/api/users', { signal }).then(r => r.json())
  )
  return (
    <Show when={() => !users.loading()} fallback={<Spinner />}>
      {() => <ul>{users.data()!.map(u => <li>{u.name}</li>)}</ul>}
    </Show>
  )
}
```

**SSR usage with `<Suspense>`:**

```tsx
function UserList() {
  const users = resource((signal) =>
    fetch('/api/users', { signal }).then(r => r.json())
  )
  const data = users.read()  // throws Promise — <Suspense> awaits it
  return <ul>{data.map(u => <li>{u.name}</li>)}</ul>
}
// wrap with: <Suspense fallback={<Spinner />}><UserList /></Suspense>
```

For SSR, prefer route-level `load()` functions (see [Router API](router-api.md)) which run before rendering begins. `resource()` is best suited to client-side data fetching after the initial page load.

---

## Lazy Loading

### `lazy(factory): Component`

Creates a lazily-loaded component. The factory is a dynamic import — the bundler code-splits at this boundary.

```ts
const Settings = lazy(() => import('./pages/Settings'))
```

While the module loads the component renders nothing. Once loaded it renders normally. Typically used with `<Route>`:

```tsx
<Route path="/settings" component={Settings} />
```

---

## DOM Rendering

### `mount(root, container): Disposer`

Mounts a JSX tree into a DOM element. Use this as your app's entry point.

```ts
import { mount } from '@stewie-js/core'

mount(<App />, document.getElementById('app')!)
```

Returns a disposer that unmounts the app and disposes all reactive effects.

---

### `hydrate(root, container): Disposer`

Hydrates a server-rendered page. Reads `window.__STEWIE_STATE__` injected by `renderToString()`, provides it via the hydration registry, then mounts the app.

In dev mode, compares the server-rendered HTML against the client render and logs a warning if they differ.

```ts
import { hydrate } from '@stewie-js/core'

hydrate(<App />, document.getElementById('app')!)
```

Use `hydrate` instead of `mount` when the page was server-rendered. See [Server API](server-api.md) for the SSR side.
