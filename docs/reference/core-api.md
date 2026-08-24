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

Signals must be created inside a component or `reactiveScope()` — not at module scope. In dev mode, creating a signal at module scope logs a warning.

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
  console.log(`Count: ${count()}`)
})

dispose()  // stop the effect
```

> **Not for setting `document.title`.** Use [`useTitle`](#usetitlevalue-void) for that — it's the right primitive and works on SSR too. `effect()` is for general side-effects that don't have a dedicated primitive.

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

Call inside a component body or inside `reactiveScope()`. If called outside any root it is silently ignored.

```ts
function DataLoader() {
  const ctrl = new AbortController()
  onCleanup(() => ctrl.abort())

  fetch('/api/data', { signal: ctrl.signal })
    .then(r => r.json())
    .then(data => /* update signals */)
}
```

This is the mechanism `useResource` uses to cancel in-flight requests when the source changes or the component unmounts.

---

### `getOwner(): Owner | null`

Returns the current reactive ownership scope, or `null` if called outside any reactive scope.

Use this together with `runInOwner` to track effects and cleanup functions created in async continuations (after `await`) back to their originating root.

```ts
reactiveScope(async (dispose) => {
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

### `reactiveScope<T>(fn): T`

Creates a reactive ownership scope and runs `fn` inside it. Use this when you need to create signals, computeds, effects, or `useResource`/`useAction` instances **outside of a component body** — for example, in a worker, a non-component utility, or a test fixture.

```ts
import { reactiveScope, signal, effect } from '@stewie-js/core'

const dispose = reactiveScope((dispose) => {
  const count = signal(0)
  effect(() => console.log(count()))
  count.set(1)  // logs: 1
  return dispose
})

dispose()  // stops the effect
```

> **You don't need this inside a component body.** Component bodies are already reactive scopes — calling `signal()`, `effect()`, or `useResource()` directly at the top of a component is the idiomatic form. `reactiveScope` is only for code that runs outside the component lifecycle.

The `dispose` argument is optional — `reactiveScope(() => { ... })` is fine when you don't need to tear down manually.

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

Like `signal`, `store` must be created inside a component or `reactiveScope()`.

---

## Context

### `createContext<T>(defaultValue?): Context<T>`

Creates a typed context token. The optional `defaultValue` is returned by `consume()` when no provider is found. Omitting it means `consume()` will throw if called without a matching provider.

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

### `consume<T>(context): T`

Reads the nearest provided value for `context`. Throws if no provider is found and the context has no default value. Pairs with `provide(context, value, fn)`: an ancestor provides, a descendant consumes.

```ts
function Button() {
  const theme = consume(ThemeContext)
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

Catches errors thrown during the **initial** render of its children and renders `fallback` instead.

```tsx
<ErrorBoundary fallback={(err) => <p>Error: {String(err)}</p>}>
  <RiskyComponent />
</ErrorBoundary>
```

::: warning Initial render only
`ErrorBoundary` wraps the first render of its children in a `try`/`catch`. Every
reactive update after that runs inside its own effect, which the boundary is not
part of — so a throw during an update is **not** caught.

```tsx
const count = signal(0)

<ErrorBoundary fallback={<p>caught</p>}>
  <div>{() => {
    if (count() === 1) throw new Error('boom')   // NOT caught
    return count()
  }}</div>
</ErrorBoundary>
```

Such an error propagates out to whatever wrote the signal — `count.set(1)` throws
at the call site — and the DOM is left mid-update. When the update was a route
change, that can mean a blank region, because the outgoing content is removed
before the incoming render throws.

Until this is addressed, guard inside the reactive expression rather than relying
on the boundary:

```tsx
<div>{() => {
  try { return render(data()) } catch { return <p>couldn't render</p> }
}}</div>
```

Tracked as an open decision in `CLAUDE.md`.
:::

---

### `<Suspense fallback>`

Shows `fallback` while children are loading. Works with `useResource(...).read()` and async data.

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

Stewie has two paired primitives for async data: **resources** for reads (anything that fetches), and **actions** for writes (anything that mutates). Both follow the same `define*` / `use*` shape:

- `define*` returns an opaque token. **Safe at module scope.** Carries no signals.
- `use*` is a free function called inside a component (or `reactiveScope`). It creates the per-component instance owning `{ data, loading, error }` (resources) or `{ run, pending, error, lastRun }` (actions).

This split is what makes the definition shareable across files without becoming an accidental cross-request singleton in SSR.

### `defineResource<S, T>(fetcher): ResourceDefinition<S, T>`

Defines a query — a fetcher that takes a source value `S` and returns data `T`. Safe to declare at module scope and import from any file.

The fetcher receives the current source value and an `{ signal }` object whose `AbortSignal` is cancelled when the source changes, `refetch()` is called, or the owning scope disposes.

```ts
// data/users.ts — module scope is fine
import { defineResource } from '@stewie-js/core'

export const fetchUser = defineResource((id: string, { signal }) =>
  fetch(`/api/users/${id}`, { signal }).then(r => r.json())
)
```

### `useResource<S, T>(def, source): Resource<T>`

Creates the per-component reactive instance. `source` is a thunk — when it changes (reactively), the fetcher re-runs with the new value.

```tsx
import { useResource, Show } from '@stewie-js/core'
import { fetchUser } from '../data/users'
import { useParams } from '@stewie-js/router'

function ProfilePage() {
  const params = useParams<{ id: string }>()
  const user = useResource(fetchUser, () => params.id)

  return (
    <Show when={() => !user.loading()} fallback={<Spinner />}>
      {() => <h1>{user.data()!.name}</h1>}
    </Show>
  )
}
```

**`Resource<T>` interface**

| Member | Description |
|--------|-------------|
| `data` | `Signal<T \| undefined>` — the resolved data, or `undefined` while loading. |
| `loading` | `Signal<boolean>` — true while the fetch is in flight. |
| `error` | `Signal<Error \| null>` — the thrown error, or `null` if none. |
| `read()` | Suspense-compatible accessor — throws a Promise while loading, throws the error on failure, returns data when ready. |
| `refetch()` | Abort the current fetch, then re-invoke the fetcher. Returns a Promise. |

**Deduplication.** Multiple components calling `useResource(fetchUser, () => '1')` share one fetch through the underlying [data registry](server-api.md#data-registry). On SSR, the resolved data is replayed on the client without a refetch.

**When to use this vs a route loader.** Route loaders run before the route mounts (good for the must-have-before-render data); `useResource` runs inside the component and refetches when its source changes (good for component-local data and query-reactive fetches). For URL-driven data that changes via `setQuery()`, prefer `useResource(fn, () => location.query.someKey)` — loaders don't re-run on `setQuery()`. See the [Stewie way guide](../guide/stewie-way.md) for a fuller walkthrough.

### `defineAction<I, O>(fn): ActionDefinition<I, O>`

Defines a mutation — an async function that takes an input `I` and returns `O`. Safe at module scope.

```ts
// actions/users.ts
import { defineAction } from '@stewie-js/core'

export const updateUserAction = defineAction(async (input: { id: string; name: string }) => {
  const res = await fetch(`/api/users/${input.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: input.name })
  })
  if (!res.ok) throw new Error('Update failed')
  return res.json()
})
```

The zero-arg overload (`defineAction(async () => ...)`) infers `I = void`, so `act.run()` takes no parameter.

### `useAction<I, O>(def): Action<I, O>`

Creates the per-component action instance.

```tsx
function EditName({ id }: { id: string }) {
  const name = signal('')
  const update = useAction(updateUserAction)

  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      const result = await update.run({ id, name: name.peek() })
      if (update.lastRun() === 'success') navigate('/profile')
    }}>
      <input $value={name} disabled={update.pending()} />
      <Show when={update.error}>{(err) => <p class="error">{err.message}</p>}</Show>
      <button disabled={update.pending()}>Save</button>
    </form>
  )
}
```

**`Action<I, O>` interface**

| Member | Description |
|--------|-------------|
| `run(input)` | Invoke the action. No-ops while `pending` is true. Returns `Promise<O \| undefined>` — `undefined` on error or while blocked. |
| `pending` | `Signal<boolean>` — true while the action is in flight. |
| `error` | `Signal<Error \| null>` — the caught error, or `null`. |
| `lastRun` | `Signal<'idle' \| 'success' \| 'error' \| 'blocked'>` — useful for branching after void-returning actions. |
| `reset()` | Clears `error` and `lastRun`. No-op while pending. |

Post-mutation work (navigation, store sync, toasts) lives in caller code after `await act.run()`. No lifecycle callbacks.

---

## Head / Metadata

Signal-driven primitives for `document.title` and `<meta>` tags. On the client they mutate `document.head` directly. On the server they register with the SSR render context — the renderer emits `<title>` / `<meta>` tags in the `<head>`, or as inline `<script>document.title = '…'</script>` patches for tags that resolve inside a Suspense boundary.

Use these instead of writing `document.title = …` in an `effect`. They are SSR-safe, batched, and cleaned up automatically.

### `useTitle(value): void`

Reactively set `document.title`. Accepts a `string`, an accessor `() => string`, or a `Signal<string>`. Must be called inside a component or `reactiveScope()`.

```tsx
function ProductPage() {
  const product = useResource(fetchProduct, () => params.id)
  useTitle(() => product.data()?.name ?? 'Loading…')
  return <article>...</article>
}
```

If multiple `useTitle` calls are active at once, the last one to run wins (matching browser semantics — one title per document). The previous title is **not** restored on cleanup; restoring would require a stack and is brittle under async navigation.

### `useMeta(props): void`

Reactively manage one `<meta>` tag in `document.head`. Identity key is `name` or `property`; subsequent reactive updates change only the `content` attribute. On cleanup, the inserted tag is removed.

```tsx
function ArticlePage() {
  const article = useResource(fetchArticle, () => params.slug)
  useMeta({ name: 'description', content: () => article.data()?.excerpt ?? '' })
  useMeta({ property: 'og:title', content: () => article.data()?.title ?? '' })
  return <article>...</article>
}
```

| Prop shape | Use for |
|---|---|
| `{ name, content }` | Standard meta tags (`description`, `keywords`, `viewport`, …). |
| `{ property, content }` | OpenGraph / Twitter cards (`og:title`, `og:image`, `twitter:card`, …). |

### `<Head>` component

For occasional needs that don't fit `useTitle`/`useMeta` — link tags, custom meta — render arbitrary children into `document.head`:

```tsx
<Head>
  <link rel="canonical" href={() => `https://example.com${location.pathname}`} />
</Head>
```

On the server, `<Head>` children are emitted into the `<head>` of the rendered document.

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
