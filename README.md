# Stewie

<img src="stewie_logo_med.png" width="200" alt="Stewie" />

**Stewie** is a TypeScript framework built edge-first for [WinterCG](https://wintercg.org/) runtimes: `@stewie-js/core` and `@stewie-js/server` use only standard Web APIs, so the same app runs on Node.js, Bun, and Cloudflare Workers without a shim layer. Routing, SSR, testing, devtools, and a compiler are designed together as one coherent framework, with route loaders → SSR state transfer → hydration as a single first-party data contract.

Just like Stewie Griffin, this framework is meant to be small, powerful, and awesome.

>❗ **Work in progress.**
>
>Stewie is under active development and may not be stable. APIs may change between releases. Not recommended for production use yet, but getting closer!

---

## Why Stewie?

### Edge-first, enforced

`@stewie-js/core` and `@stewie-js/server` use only standard Web APIs — `Request`, `Response`, `ReadableStream`, `fetch`. No Node.js-specific imports are allowed in either package, and `scripts/check-edge-packages.mjs` enforces that boundary in CI via static analysis, not just by convention. First-party adapters ship for **Node.js**, **Bun**, and **Cloudflare Workers** today. A Deno Deploy adapter is on the roadmap — the standards-first design means no fundamental rework is needed to add it.

### `createRoute`: one declaration, not three

```tsx
export const ProjectEditRoute = createRoute(
  '/projects/:projectId/edit',
  { component: EditProjectPage, load: projectEditLoader }
)
// params typed from the path literal: { projectId: string }
```

The value returned by `createRoute` is at once the JSX mount point (`<ProjectEditRoute />`), the type carrier that `useParams(route)` / `useQuery(route)` read to recover param and query types, and the place the loader and guard for that route live. There's no separate route config object, route type, and path string to keep in sync by hand.

### Localized updates, not a render cycle

Signals subscribe directly to the DOM expressions that read them. `signal.set()` updates exactly those expressions; component functions run once at setup, not on every state change, so there's no render cycle to opt out of with memoization helpers:

```tsx
function Counter() {
  const count = signal(0)
  const doubled = computed(() => count() * 2)

  return (
    <button onClick={() => count.update((n) => n + 1)}>
      {count} / {doubled}
    </button>
  )
}
```

A Vite compiler plugin (`@stewie-js/vite`) breaks components like this down further into fine-grained reactive output automatically, but it's optional — plain JSX via `jsxImportSource` produces a fully working app without it.

### TypeScript-native from day one

Stewie is written in TypeScript and ships TypeScript directly — no separately maintained `@types/*` package to fall out of sync with the runtime.

### JSX with real scope

Stewie uses JSX: TypeScript knows exactly what's in scope at every point, your editor flags errors inline, and `<PrimaryButton />` is a real identifier you can search, refactor, and navigate — not a string template that needs a separate tool to catch scope errors.

### Small, coherent by design

Routing, reactivity, SSR, testing utilities, and devtools are coordinated first-party packages, designed together, rather than assembled from third-party pieces that may conflict, lag behind, or disappear:

| Need | Stewie |
|------|--------|
| Routing | `@stewie-js/router` |
| Global state | `store()` built-in |
| SSR | `@stewie-js/server` |
| Testing | `@stewie-js/testing` |

---

## Packages

| Package | Description |
|---|---|
| [`@stewie-js/core`](packages/core) | Signals, computed, effects, store, JSX runtime, context, control flow, hydration |
| [`@stewie-js/server`](packages/server) | `renderToString` and `renderToStream` — WinterCG-compatible SSR |
| [`@stewie-js/router`](packages/router) | Reactive URL-as-store routing with `<Router>`, `<Route>`, `<Link>` |
| [`@stewie-js/router-spi`](packages/router-spi) | Interface-only SPI for swappable router implementations |
| [`@stewie-js/vite`](packages/vite) | Vite plugin — JSX transform, HMR |
| [`@stewie-js/adapter-node`](packages/adapter-node) | Node.js HTTP adapter |
| [`@stewie-js/adapter-bun`](packages/adapter-bun) | Bun HTTP adapter |
| [`@stewie-js/adapter-cloudflare`](packages/adapter-cloudflare) | Cloudflare Workers HTTP adapter |
| [`@stewie-js/testing`](packages/testing) | `mount`, DOM queries, signal assertions, SSR helpers |
| [`@stewie-js/devtools`](packages/devtools) | Browser overlay devtools — renders, stores, routes, live signal dependency graph |
| [`@stewie-js/compiler`](packages/compiler) | TSX → fine-grained reactive output compiler |
| [`create-stewie`](packages/create-stewie) | Project scaffolding CLI |

---

## Quick Start

It is recommended to use the Stewie template to scaffold out your project.

```bash
# pnpm
pnpm create stewie my-app
cd my-app
pnpm install
pnpm run dev
```

```bash
# npm
npm init stewie my-app
cd my-app
npm install
npm run dev
```

```bash
# bun
bun create stewie my-app
cd my-app
bun install
bun run dev
```

---

## Core Concepts

### Signals

Signals, computeds, effects, and stores must be created inside a component (or `reactiveScope()`) — never at module scope. Component bodies are already reactive scopes, so this is the natural place they live:

```tsx
import { signal, computed, effect } from '@stewie-js/core'

function Stats() {
  const count = signal(0)
  const disabled = computed(() => count() >= 5)

  effect(() => {
    console.log('count:', count(), 'disabled:', disabled())
  });

  return (
    <div>
      <p>Count: {count}</p>
      <button disabled={disabled()} onClick={() => count.update((n) => n + 1)}>Add 1</button>
    </div>
  )
}
```

### Store

```tsx
function Profile() {
  const state = store({ user: { name: 'Alice', favoriteColor: 'purple' }, todos: [] as string[] })
  state.todos.push('Learn Stewie')

  return (
    <div>
      {/* Only the DOM bindings that read `state.todos` will update when `state.todos` is mutated */}
      <p>Welcome {state.user.name}</p>
      <p>Remaining Tasks: {state.todos.length}</p>
      <NewTodoItem onAddItem={(label) => state.todos.push(label)} />
    </div>
  )
}
```

### Components & JSX

```tsx
import { signal } from '@stewie-js/core'
import { Show, For } from '@stewie-js/core'

function Counter() {
  const count = signal(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => count.update(n => n + 1)}>+</button>
    </div>
  )
}

function TodoList({ items }: { items: string[] }) {
  const show = signal(true)

  return (
    <div>
      <Show when={show}>
        <For each={() => items}>
          {(item) => <li>{item}</li>}
        </For>
      </Show>
    </div>
  )
}
```

### Context

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

---

## Server-Side Rendering

`renderToString` returns `{ html, stateScript, headHtml }` separately so you control where each lands in your document:

```tsx
// src/server.ts
import { renderToString } from '@stewie-js/server'
import { createNodeHandler } from '@stewie-js/adapter-node'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import App from './App.js'
import { jsx } from '@stewie-js/core'

const template = readFileSync('dist/client/index.html', 'utf-8')

const handler = createNodeHandler(async (_req) => {
  const { html, stateScript, headHtml } = await renderToString(jsx(App, {}))
  const page = template
    .replace('<!--ssr-head-->', headHtml)
    .replace('<!--ssr-outlet-->', html)
    .replace('</body>', `  ${stateScript}\n  </body>`)
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } })
})

createServer(handler).listen(3000)
```

```tsx
// src/client.tsx — hydrates the server-rendered HTML
import { hydrate } from '@stewie-js/core'
import App from './App.js'

hydrate(<App />, document.getElementById('app')!)
```

The `stateScript` injects `window.__STEWIE_STATE__` — a single serialized payload that `hydrate()` reads to initialize client state from server values, avoiding a second round-trip fetch. `headHtml` carries anything registered via `useTitle` / `useMeta` / `<Head>` (see `<!--ssr-head-->` above) — without injecting it, head/title content set during SSR never reaches the response.

---

## Routing

```tsx
import { Router, Route, Link, useRouter } from '@stewie-js/router'

function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/users/:id" component={UserDetail} />
    </Router>
  )
}

function UserDetail() {
  const router = useRouter()
  const id = () => router.location.params.id

  return (
    <div>
      <Link to="/">← Back</Link>
      <h1>User {id()}</h1>
    </div>
  )
}
```

---

## Vite Config

```ts
// vite.config.ts
import { stewie, defineConfig } from '@stewie-js/vite'

export default defineConfig({
  plugins: [stewie()]
})
```

---

## Development

```bash
pnpm install        # install all workspace deps
pnpm build          # build all packages
pnpm test           # run all tests
```

Per-package:

```bash
pnpm --filter @stewie-js/core build
pnpm --filter @stewie-js/core test
pnpm --filter ssr-and-routing dev
```

See [`examples/ssr-and-routing`](examples/ssr-and-routing) for a full SSR + routing example app.
