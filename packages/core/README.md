# @stewie-js/core

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

The reactive foundation of Stewie. Provides fine-grained signals, computed values, effects, a proxy-based store, a JSX runtime, context, and built-in control flow components. No virtual DOM — reactive expressions subscribe directly to the DOM nodes they affect.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add @stewie-js/core
```

## Reactivity

```ts
import { signal, computed, effect } from '@stewie-js/core'

const count = signal(0)
const doubled = computed(() => count() * 2)

effect(() => {
  console.log('count:', count(), 'doubled:', doubled())
})

count.set(5)        // logs: count: 5 doubled: 10
count.update(n => n + 1) // logs: count: 6 doubled: 12
```

## Store

A `Proxy`-based reactive object. Only the specific properties a component reads are tracked — changing an unrelated property causes no update.

```ts
import { store } from '@stewie-js/core'

const state = store({ user: { name: 'Alice' }, todos: [] as string[] })

state.user.name = 'Bob'       // only components reading user.name update
state.todos.push('Buy milk')  // only components reading todos update
```

## JSX

Configure your `tsconfig.json` to use Stewie's JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@stewie-js/core"
  }
}
```

If you are using `@stewie-js/vite`, the plugin sets these options automatically — no manual `tsconfig.json` changes are needed.

Attribute expressions that are functions are wrapped in fine-grained effects. Static values are set once with no subscription.

```tsx
import { signal } from '@stewie-js/core'

function Counter() {
  const count = signal(0)
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => count.update(n => n + 1)}>+</button>
    </div>
  )
}
```

## Control Flow

```tsx
import { Show, For, Switch, Match } from '@stewie-js/core'

// Conditional rendering
<Show when={() => loggedIn()}>
  <Dashboard />
</Show>

// Keyed list rendering
<For each={() => items()}>
  {(item) => <li>{item.name}</li>}
</For>

// Switch/Match
<Switch>
  <Match when={() => status() === 'loading'}><Spinner /></Match>
  <Match when={() => status() === 'error'}><Error /></Match>
  <Match when={true}><Content /></Match>
</Switch>
```

## Context

```tsx
import { createContext, consume } from '@stewie-js/core'

const ThemeContext = createContext('light')

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Page />
    </ThemeContext.Provider>
  )
}

function Page() {
  const theme = consume(ThemeContext) // 'dark'
  return <div class={`theme-${theme}`}>...</div>
}
```

## API

| Export | Description |
|---|---|
| `signal(value)` | Reactive value — `.set()`, `.update()`, call to read |
| `computed(fn)` | Lazy derived value, memoized on strict equality |
| `effect(fn)` | Runs immediately, re-runs on dependency change, returns dispose |
| `batch(fn)` | Defer notifications until `fn` completes |
| `untrack(fn)` | Read reactive values without subscribing |
| `store(obj)` | Proxy-wrapped reactive object with path-level subscriptions |
| `createContext(default)` | Create a typed context token |
| `consume(ctx)` | Read the nearest provided context value |
| `provide(ctx, value, fn)` | Run `fn` with a context value provided |
| `reactiveScope(fn)` | Create an isolated reactive scope |
| `mount(element, container)` | Render a JSX element into a DOM node |
| `hydrate(element, container)` | Mount with server state from `window.__STEWIE_STATE__` |
| `Show` | Conditional rendering component |
| `For` | Keyed list rendering component |
| `Switch` / `Match` | First-match conditional rendering |
| `Portal` | Render children into a different DOM node |
| `ErrorBoundary` | Catch rendering errors and show a fallback |
| `Suspense` | Async loading boundary — shows fallback while children resolve |
| `lazy(fn)` | Lazily load a component, integrates with `Suspense` |
| `resource(fetcher)` | Async data primitive that integrates with `Suspense` |
| `ClientOnly` | Render children on client only (empty string on server) |
| `HydrationRegistryContext` | Context token for the hydration registry (SSR workflows) |
| `useHydrationRegistry()` | Read the hydration registry from inside a component |
| `captureContext()` | Capture the current context map for later restoration |
| `runWithContext(ctx, fn)` | Run `fn` inside a previously captured context |
