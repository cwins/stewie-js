# Server-Side Rendering

Stewie supports SSR with `@stewie-js/server`. The renderer is WinterCG-compatible — it uses only standard web APIs (`ReadableStream`, `Response`) and runs on Node.js 18+, Bun, Deno, Cloudflare Workers, and other WinterCG runtimes.

---

## Why SSR

- **Faster first paint** — the browser renders HTML immediately rather than waiting for JavaScript to load and run
- **SEO** — search engines see full HTML content
- **Resilience** — pages render even if JavaScript fails to load or is disabled

Stewie supports both full-document rendering (`renderToString`) and progressive streaming (`renderToStream`).

---

## Installation

```bash
pnpm add @stewie-js/server
# plus the adapter for your runtime:
pnpm add @stewie-js/adapter-node   # Node.js
pnpm add @stewie-js/adapter-bun    # Bun
```

---

## `renderToString`

Renders the component tree to a complete HTML string. Waits for all `<Suspense>` boundaries to resolve before returning — the result is a full document, suitable for CDN caching.

```ts
import { renderToString } from '@stewie-js/server'

const { html, stateScript } = await renderToString(<App initialUrl={req.url} />)

const page = `
  <!doctype html>
  <html>
    <body>
      <div id="app">${html}</div>
      ${stateScript}
      <script type="module" src="/assets/client.js"></script>
    </body>
  </html>
`
```

`stateScript` is the `<script>` tag that sets `window.__STEWIE_STATE__`. It must appear before the client bundle so the hydration registry is populated before `hydrate()` runs.

---

## `renderToStream`

Streams HTML progressively using `ReadableStream`. The initial shell is sent immediately; `<Suspense>` boundaries resolve and inject inline `<script>` chunks as their data arrives.

```ts
import { renderToStream } from '@stewie-js/server'

// In a WinterCG request handler:
const stream = renderToStream(<App initialUrl={req.url} />)

return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' }
})
```

Streaming is better for time-to-first-byte when parts of the page take longer to load (e.g. database queries behind a `<Suspense>` boundary). The browser can start rendering and executing JavaScript as chunks arrive.

---

## Hydration

After the server renders the initial HTML, the client takes over by calling `hydrate()` instead of `mount()`. This reuses the existing server-rendered DOM rather than discarding it.

```ts
// src/client.ts
import { hydrate } from '@stewie-js/core'

hydrate(<App />, document.getElementById('app')!)
```

`hydrate()` reads `window.__STEWIE_STATE__`, deserializes it into a hydration registry, and makes it available to the component tree before any rendering begins. Components that stored state during SSR (via `useHydrationRegistry`) can read it back on the client without an extra network round-trip.

In dev mode, `hydrate()` compares the server-rendered HTML against the client render and logs a warning if they differ — helpful for catching components that render differently on server and client.

---

## The hydration registry

The hydration registry is the mechanism for passing server-fetched state to the client in a single serialized payload.

On the server:

```tsx
import { createHydrationRegistry, HydrationRegistryContext } from '@stewie-js/server'

const registry = createHydrationRegistry()

const { html, stateScript } = await renderToString(
  <HydrationRegistryContext.Provider value={registry}>
    <App initialUrl={req.url} />
  </HydrationRegistryContext.Provider>
)
```

**You usually don't need to touch this directly.** Both route loaders and `useResource` already write their results into the registry under stable keys (`route:${path}:${paramsHash}` and `${defId}:${argsHash}` respectively), and `hydrate()` seeds the registry on the client from the inline `__STEWIE_DATA__` payload. A component calling `useResource(fetchMe, () => undefined)` on the server publishes its result; the same call on the client reads it back with no refetch.

The lower-level `useHydrationRegistry` / `useDataRegistry` hooks exist for primitives that want to participate in the same SSR-replay mechanism without going through `useResource` — most app code should not need them.

For most use cases, prefer route-level data loading (see [Routing — data loading](routing.md#route-level-data-loading)) for must-have-before-render data and `useResource` for component-local fetches. Both round-trip through SSR automatically.

---

## `<ClientOnly>`

Some components use browser-only APIs and cannot run on the server. Wrap them in `<ClientOnly>`:

```tsx
import { ClientOnly } from '@stewie-js/core'

<ClientOnly>
  <MapWidget />   {/* uses window, navigator, canvas, etc. */}
</ClientOnly>
```

On the server, `<ClientOnly>` renders nothing. On the client, it renders its children normally after hydration.

---

## CSP nonces

Both `renderToString` and `renderToStream` accept a `nonce` option for Content Security Policy compliance. The nonce is applied to any `<script>` tags injected by the renderer.

```ts
const { html, stateScript } = await renderToString(<App />, {
  nonce: req.headers.get('x-nonce') ?? undefined
})
```

---

## Route guards and data loading during SSR

When using `@stewie-js/router`, `beforeEnter` guards and route-level `load()` functions must run before the render so the server can either redirect or include pre-loaded data in the HTML.

Use `createSsrRouter` from `@stewie-js/router`:

```ts
import { createSsrRouter, RedirectError, Router, Route } from '@stewie-js/router'
import { renderToString } from '@stewie-js/server'

// Define routes as an array — reuse in both createSsrRouter and <Router>
const routeChildren = [
  jsx(Route, { path: '/', component: Home }),
  jsx(Route, { path: '/protected', component: Protected, beforeEnter: authGuard }),
  jsx(Route, { path: '/data', component: DataPage, load: () => fetchPageData() }),
]

async function handleRequest(req: Request): Promise<Response> {
  let ssrRouter
  try {
    ssrRouter = await createSsrRouter(req.url, routeChildren)
  } catch (err) {
    if (err instanceof RedirectError) {
      return new Response(null, { status: 302, headers: { location: err.location } })
    }
    throw err
  }

  const { html, stateScript } = await renderToString(
    jsx(Router, { router: ssrRouter, children: routeChildren })
  )
  return new Response(html + stateScript, {
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })
}
```

`createSsrRouter` runs guards and loaders before rendering begins. If a guard returns a redirect URL, it throws `RedirectError` — catch it and return an HTTP 302. Otherwise it returns a pre-configured `Router` instance; pass it as `router={ssrRouter}` so the component skips re-running guards and uses the already-loaded route data.

Route data loaded via `load()` is available inside the rendered component via `useRouteData()`.

---

## Platform adapters

`@stewie-js/server` is runtime-agnostic. Platform adapters translate the native request format to the standard `Request`/`Response` interface.

**Node.js** (`@stewie-js/adapter-node`):

```ts
import { createNodeHandler } from '@stewie-js/adapter-node'
import http from 'node:http'

const server = http.createServer(createNodeHandler(handleRequest))
server.listen(3000)
```

**Bun** (`@stewie-js/adapter-bun`):

```ts
import { createBunHandler } from '@stewie-js/adapter-bun'

Bun.serve({
  fetch: createBunHandler(handleRequest)
})
```

In both cases, `handleRequest` is an async function that receives a `Request` and returns a `Response`.

---

## Build setup

An SSR app requires two Vite builds: one for the client bundle and one for the server entry point.

```ts
// vite.config.ts
import { stewie, defineConfig } from '@stewie-js/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [stewie()],
  environments: {
    client: {
      build: {
        outDir: resolve(__dirname, 'dist/client'),
        rollupOptions: { input: 'index.html' }
      }
    },
    ssr: {
      build: {
        outDir: resolve(__dirname, 'dist/server'),
        rollupOptions: {
          input: 'src/server.ts',
          output: { format: 'esm', entryFileNames: '[name].js' }
        }
      }
    }
  }
})
```

Run `pnpm vite build && pnpm vite build --ssr` to produce both bundles. The scaffolded project from `create-stewie` sets this up for you.

---

## Further reading

- [Server API Reference](../reference/server-api.md) — renderToString, renderToStream, hydration registry
- [Router — SSR setup](routing.md#server-side-rendering)
