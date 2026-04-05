# Server API Reference

`@stewie-js/server` provides WinterCG-compatible server-side rendering. It has no Node.js-specific dependencies and runs in any runtime that implements the WinterCG standard (`Request`/`Response`/`ReadableStream`): Node.js 18+, Bun, Deno, Cloudflare Workers, and others.

---

## `renderToString(component, options?): Promise<RenderResult>`

Renders a component tree to an HTML string. Waits for all `<Suspense>` boundaries to resolve before returning — the result is a complete document suitable for CDN caching.

```ts
import { renderToString } from '@stewie-js/server'

const { html, stateScript } = await renderToString(<App />)
```

Inject `html` at your SSR outlet and `stateScript` just before `</body>`:

```ts
const page = `
  <!doctype html>
  <html>
    <body>
      <div id="app">${html}</div>
      ${stateScript}
      <script type="module" src="/src/client.ts"></script>
    </body>
  </html>
`
```

**`RenderResult`**

| Property | Type | Description |
|----------|------|-------------|
| `html` | `string` | The rendered component HTML. |
| `stateScript` | `string` | A `<script>` tag that sets `window.__STEWIE_STATE__` to the serialized hydration state. Inject just before `</body>`. |

**`RenderToStringOptions`**

| Option | Type | Description |
|--------|------|-------------|
| `nonce` | `string` | CSP nonce applied to the injected `<script>` tag. |

---

## `renderToStream(component, options?): ReadableStream`

Streams HTML progressively. The initial shell is sent immediately; `<Suspense>` boundaries resolve and inject inline `<script>` chunks as their data arrives.

```ts
import { renderToStream } from '@stewie-js/server'

const stream = renderToStream(<App />)

// In a WinterCG handler:
return new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' }
})
```

The stream uses only `ReadableStream` and `TransformStream` — no Node.js stream APIs.

**`RenderToStreamOptions`**

| Option | Type | Description |
|--------|------|-------------|
| `nonce` | `string` | CSP nonce applied to inline `<script>` chunks injected for Suspense boundaries. |

---

## Hydration Registry

The hydration registry collects serializable state during SSR and injects it as `window.__STEWIE_STATE__`. On the client, `hydrate()` reads this state and makes it available to components before any rendering begins — avoiding a second round-trip for data that was already fetched on the server.

---

### `createHydrationRegistry(): HydrationRegistry`

Creates a registry for use during an SSR render. Provide it via `HydrationRegistryContext` so components in the tree can store and retrieve their initial state.

```ts
import { createHydrationRegistry, HydrationRegistryContext } from '@stewie-js/server'

const registry = createHydrationRegistry()

const { html, stateScript } = await renderToString(
  <HydrationRegistryContext.Provider value={registry}>
    <App />
  </HydrationRegistryContext.Provider>
)
```

**`HydrationRegistry` interface**

| Method | Description |
|--------|-------------|
| `set(key, value)` | Store a serializable value under `key`. |
| `get(key)` | Retrieve a value by `key`. |
| `serialize()` | Serialize all stored values to a JSON string. Called internally by `renderToString`. |

---

### `HydrationRegistryContext`

The context token used to provide and inject the hydration registry. Both `@stewie-js/server` and `@stewie-js/core` export it.

---

### `useHydrationRegistry(): HydrationRegistry`

Injects the active hydration registry. Use this inside a component to store or read hydration state.

```ts
import { useHydrationRegistry } from '@stewie-js/core'

function UserProfile() {
  const registry = useHydrationRegistry()

  // On server: fetch data and store it
  // On client: read it back before the first fetch
  const cached = registry.get('user-profile')
  ...
}
```

---

## Platform Adapters

`@stewie-js/server` is runtime-agnostic. Platform adapters wire it to each runtime's HTTP server:

- **`@stewie-js/adapter-node`** — `createNodeHandler(app)` wraps a Node.js `http.RequestListener`
- **`@stewie-js/adapter-bun`** — `createBunHandler(app)` returns a `Bun.serve()` fetch handler

See those packages' READMEs for usage examples.

---

## Client-side entry point

After server rendering, use `hydrate()` from `@stewie-js/core` instead of `mount()` to attach the app to the server-rendered DOM:

```ts
// src/client.ts
import { hydrate } from '@stewie-js/core'

hydrate(<App />, document.getElementById('app')!)
```

`hydrate()` reads `window.__STEWIE_STATE__`, provides the hydration registry to the component tree, and in dev mode warns about any mismatch between the server-rendered HTML and the client render. See [Core API — `hydrate`](core-api.md#hydrateroot-container-disposer).
