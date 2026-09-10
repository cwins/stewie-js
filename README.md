# Stewie

<img src="stewie_logo_med.png" width="200" alt="Stewie" />

**Stewie** is a small, coherent TypeScript web framework for modern edge runtimes. Reactivity, rendering, SSR, routing, a compiler, testing utilities, and devtools are designed together as one system, not assembled from a pile of independently-versioned third-party pieces. `@stewie-js/core` and `@stewie-js/server` are built on standard Web APIs from the ground up, so the same app runs on Node.js, Bun, and Cloudflare Workers with no shim layer.

Just like Stewie Griffin, this framework is meant to be small, powerful, and awesome.

>❗ **Work in progress.**
>
>Stewie is under active development and may not be stable. APIs may change between releases. Not recommended for production use yet, but getting closer!

---

## Why Stewie?

### Edge-first, and it's enforced

`@stewie-js/core` and `@stewie-js/server` use only standard Web APIs — `Request`, `Response`, `ReadableStream`, `fetch` — with zero Node.js dependencies. That's a hard boundary, not a stated intention: [`scripts/check-edge-packages.mjs`](scripts/check-edge-packages.mjs) statically checks it in CI, so a stray `import { readFileSync } from 'fs'` fails the build before it ships. First-party adapters run the same app on **Node.js**, **Bun**, and **Cloudflare Workers** today. A Deno adapter is on the roadmap — the standards-first design means no fundamental rework is needed to add it.

### A first-party data story, end to end

Route loaders fetch data on navigation. `renderToString` / `renderToStream` serialize each result inline, next to the component that used it, instead of as one blob at the end of the stream — so an early Suspense boundary doesn't wait on a later one's data. `hydrate()` replays that data into the same registry `useResource` reads from, so the client picks up without a second fetch. Loaders, SSR state transfer, hydration, and the client cache are one designed contract, not several libraries you have to wire together yourself.

### `createRoute`: one declaration, three jobs

```tsx
export const ProjectEditRoute = createRoute('/projects/:projectId/edit', {
  component: EditProjectPage,
  load: projectEditLoader,
})
```

`ProjectEditRoute` is simultaneously the JSX mount point (`<ProjectEditRoute />` inside `<Router>`), the type carrier for its path params, and the argument to `useParams(ProjectEditRoute)` / `useQuery(ProjectEditRoute)` anywhere in the tree — no separate route-types file to keep in sync, no generic to remember at the call site.

### Localized updates, not re-render cascades

A signal update writes to exactly the DOM nodes that read it. Component functions run once, at setup — there's no render cycle above them to re-run, so there's nothing to reach for `memo` / `useMemo` / `useCallback` to guard against. The compiler is responsible for breaking a component into fine-grained reactive pieces; you just write the obvious code:

```tsx
const expensiveValue = computed(() => compute(a(), b()))
```

### TypeScript-native from day one

Stewie is written in TypeScript and ships TypeScript — no separately maintained `@types/*` package to fall out of sync with the framework.

### JSX with full TypeScript scope

TypeScript knows exactly what's in scope at every point in a `.tsx` file, so your editor flags errors inline, and `<PrimaryButton />` is a real identifier you can search, refactor, and jump to.

### Small and coherent, not a pile of parts

| Need | Stewie |
|------|--------|
| Routing | `@stewie-js/router` |
| Global state | `store()`, built in |
| SSR | `@stewie-js/server` |
| Testing | `@stewie-js/testing` |
| Devtools | `@stewie-js/devtools` |

Each of these is designed against the others, rather than picked up separately and hoped into compatibility — it's why the data story above is one contract instead of four. This is the hardest of Stewie's bets to put a number on; coherence is felt over the life of a project, not benchmarked.

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
