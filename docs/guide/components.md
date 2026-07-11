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

You do not need to call `reactiveScope()` inside a component — the renderer already provides a reactive scope. See [When to Use `reactiveScope`](../patterns/reactive-scope.md).

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

### Two-way binding with `$prop`

Wiring a form input to a signal by hand means reading it in one place and writing it back in an event handler:

```tsx
<input value={name()} onInput={e => name.set((e.target as HTMLInputElement).value)} />
```

The compiler gives you a shorthand: prefix the prop with `$` and pass the signal. `$value={name}` expands to exactly the read-plus-write pair above:

```tsx
<input $value={name} />          {/* value={name()} + onInput → name.set(...) */}
<input type="checkbox" $checked={done} />   {/* checked={done()} + onChange → done.set(...) */}
<select $value={sort}>...</select>          {/* select fires change, not input — handled */}
```

This is a compiler convenience, not a new runtime concept: `$value` compiles down to the same fine-grained binding you'd write yourself, so there's no wrapper, no special element, and nothing to learn beyond the `$` prefix. The convention is borrowed from SwiftUI's `$` bindings.

- `$value` on a text input binds via `onInput`; on a `<select>` it binds via `onChange`.
- `$checked` binds a checkbox via `onChange` and `e.target.checked`.
- Passing both `$value` and a plain `value` on the same element is a conflict the compiler flags.

`$prop` requires the `@stewie-js/vite` compiler plugin. Without it, write the read/write pair by hand — the runtime is identical either way.

---

## Control flow

Stewie's control-flow components — `<Show>`, `<For>`, `<Switch>`/`<Match>` — deliberately match the shape SolidJS established, down to the `when` / `each` / `fallback` prop names. That shape is proven and there was no reason to rename it for the sake of looking different. If you're coming from Solid, these will feel familiar on purpose.

What's Stewie's, underneath the familiar surface: these compile to **fine-grained, real-DOM updates with no virtual DOM and no diffing** — a `<Show>` toggling only swaps its own branch, a `<For>` reorders with a keyed LIS reconcile that moves the minimum number of nodes. The same components run identically under SSR, streaming, and DOM-claiming hydration, and the devtools **Renders** tab highlights exactly which anchor updated and why. The API is shared; the machinery and the coherence with the rest of the framework are the point.

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

**Consuming:**

```ts
function Button() {
  const theme = consume(ThemeContext)
  return <button class={theme}>Click</button>
}
```

`consume` reads the nearest provided value. If no provider is found, it returns the default value passed to `createContext`. If there is no default, it throws.

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
  const theme = consume(ThemeContext)
  return <button class={() => theme()}>Click</button>
}
```

---

## Async data

Stewie's async-data primitive is a pair: `defineResource` declares the fetcher at module scope (it carries no signals, so this is safe in SSR); `useResource` inside a component creates the reactive instance.

```ts
// data/users.ts
import { defineResource } from '@stewie-js/core'

export const fetchMe = defineResource((_: void, { signal }) =>
  fetch('/api/me', { signal }).then(r => r.json())
)
```

```tsx
import { useResource, Show } from '@stewie-js/core'
import { fetchMe } from '../data/users'

function UserProfile() {
  const user = useResource(fetchMe, () => undefined)

  return (
    <Show when={() => !user.loading()} fallback={<Spinner />}>
      {() => <div>{user.data()!.name}</div>}
    </Show>
  )
}
```

The fetcher's second argument is `{ signal: AbortSignal }`. Pass it to `fetch()` so the network request is cancelled when the source changes, `refetch()` is called, or the component unmounts.

The second argument to `useResource` is the **source thunk** — when it changes (reactively), the fetcher re-runs with the new value. `useResource(fetchUser, () => params.id)` refetches whenever the param signal changes; `useResource(fetchMe, () => undefined)` fetches once.

Use `user.error()` to check for failures and `user.refetch()` to re-trigger the fetch. See the [Core API reference](../reference/core-api.md#async-data) for the full `Resource<T>` shape and the paired `defineAction`/`useAction` primitives for mutations.

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
