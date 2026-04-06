# Components

Stewie components are plain TypeScript functions that return JSX. There are no classes, no decorators, and no lifecycle methods — just functions and reactive primitives.

---

## Function components

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>
}
```

A component function runs once when the component is first mounted. Reactive updates happen at the expression level — only the specific DOM nodes bound to changed values update.

### Local state

Create signals and computed values directly in the component body:

```tsx
function Counter() {
  const count = signal(0)
  const doubled = computed(() => count() * 2)

  return (
    <div>
      <p>{count} × 2 = {doubled}</p>
      <button onClick={() => count.update(n => n + 1)}>+</button>
    </div>
  )
}
```

You do not need to call `createRoot()` inside a component — the renderer already provides a reactive scope. See [When to Use `createRoot`](../patterns/create-root.md).

---

## JSX

Stewie JSX looks like React JSX but behaves differently. There is no re-render — instead, reactive expressions create direct subscriptions to DOM nodes.

### Static expressions

A value that is not reactive is written once and never updated:

```tsx
<p class="title">Hello</p>          // string — set once
<input disabled={isAdmin} />        // boolean variable — set once
<img src={avatarUrl} alt="Avatar" />
```

### Reactive expressions

Pass a signal directly, or wrap the expression in a function, to make it reactive:

```tsx
// signal passed directly — Stewie subscribes the text node
<p>{count}</p>

// getter function — re-evaluated when dependencies change
<p>{() => count() * 2}</p>

// reactive attribute
<div class={() => isActive() ? 'active' : ''}>...</div>
```

When a JSX expression evaluates a signal or store property, Stewie sets up a fine-grained subscription. Only that DOM node or attribute updates — not the component, not its siblings.

### Event handlers

Event handlers are plain functions:

```tsx
<button onClick={() => count.update(n => n + 1)}>+</button>
<input onInput={(e) => name.set((e.target as HTMLInputElement).value)} />
```

### HTML attributes

Stewie uses `class` (not `className`) and other standard HTML attribute names.

---

## Control flow

### `<Show>` — conditional rendering

```tsx
<Show when={() => user() !== null} fallback={<p>Please log in.</p>}>
  <UserProfile />
</Show>
```

When `children` depend on reactive values, use a **function child** so props are re-evaluated when the branch mounts:

```tsx
<Show when={() => data() !== null}>
  {() => <DataView items={data()!} />}
</Show>
```

See [Reactive Branches and Child Component Props](../patterns/reactive-branches.md) for why this matters.

### `<For>` — list rendering

```tsx
<For each={todos} by={(todo) => todo.id}>
  {(getTodo) => (
    <li class={() => getTodo().done ? 'done' : ''}>
      {() => getTodo().text}
    </li>
  )}
</For>
```

The `by` prop is a key function — always provide it. Without it, the list is unkeyed and all rows re-render on every change.

The child function receives a reactive getter (`getTodo`), not the item directly. Reading inside JSX expressions subscribes to that specific item's updates.

`each` can be a plain array, a signal, or a getter function. Reactive arrays (store properties or computed values) update the list automatically.

### `<Switch>` / `<Match>` — multiple branches

```tsx
<Switch fallback={<p>Unknown status</p>}>
  <Match when={() => status() === 'loading'}><Spinner /></Match>
  <Match when={() => status() === 'error'}><ErrorView /></Match>
  <Match when={() => status() === 'ready'}>
    {() => <DataView data={data()!} />}
  </Match>
</Switch>
```

---

## Context

Context passes values through the component tree without threading them through every prop.

```ts
// define the context token (usually in a shared module)
const ThemeContext = createContext<'light' | 'dark'>('light')
```

**Providing:**

```tsx
<ThemeContext.Provider value="dark">
  <App />
</ThemeContext.Provider>
```

**Injecting:**

```ts
function Button() {
  const theme = inject(ThemeContext)
  return <button class={theme}>Click</button>
}
```

`inject` reads the nearest provided value. If no provider is found, it returns the default value passed to `createContext`. If there is no default, it throws.

### Reactive context values

If you want the context value itself to be reactive, provide a signal:

```tsx
const theme = signal<'light' | 'dark'>('light')

<ThemeContext.Provider value={theme}>
  <App />
</ThemeContext.Provider>
```

```ts
function Button() {
  const theme = inject(ThemeContext)
  return <button class={() => theme()}>Click</button>
}
```

---

## Async data

`resource` wraps an async function and exposes reactive signals for loading state, data, and error:

```tsx
function UserProfile() {
  const user = resource((signal) =>
    fetch('/api/me', { signal }).then(r => r.json())
  )

  return (
    <Show when={() => !user.loading()} fallback={<Spinner />}>
      {() => <div>{user.data()!.name}</div>}
    </Show>
  )
}
```

The fetcher receives an `AbortSignal`. Pass it to `fetch()` so the network request is cancelled when the component unmounts or when `refetch()` is called. If you don't need cancellation you can ignore it.

Use `user.error()` to check for failures and `user.refetch()` to re-trigger the fetch.

---

## Lazy loading

Code-split a component with `lazy`:

```ts
const Settings = lazy(() => import('./pages/Settings'))
```

The component renders nothing while the module loads, then renders normally. Works directly with `<Route>`:

```tsx
<Route path="/settings" component={Settings} />
```

---

## Lifecycle

There are no `onMount` / `onUnmount` lifecycle hooks. Use `effect` with a cleanup function instead:

```ts
function LiveClock() {
  const time = signal(new Date())

  effect(() => {
    const id = setInterval(() => time.set(new Date()), 1000)
    return () => clearInterval(id)  // runs on unmount
  })

  return <p>{() => time().toLocaleTimeString()}</p>
}
```

The cleanup function runs before the next effect execution and when the component unmounts.

---

## Further reading

- [Core API — Control Flow](../reference/core-api.md#control-flow) — Show, For, Switch/Match, Portal, ErrorBoundary, Suspense, ClientOnly
- [Core API — Context](../reference/core-api.md#context)
- [Core API — Async Data](../reference/core-api.md#async-data)
- [Reactive Branches and Child Component Props](../patterns/reactive-branches.md)
