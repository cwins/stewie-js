# @stewie-js/server

> **Work in progress.** APIs may change between releases.

WinterCG-compatible server-side rendering for Stewie. Renders component trees to HTML strings or streaming `ReadableStream`s using only standard web APIs — no Node.js dependencies, runs on any WinterCG-compliant runtime (Node 18+, Bun, Deno, Cloudflare Workers).

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add @stewie-js/server @stewie-js/core
```

## renderToString

Returns `{ html, stateScript }` separately so you control where each is placed in the document.

```ts
import { renderToString } from '@stewie-js/server'
import { jsx } from '@stewie-js/core'
import App from './App.js'

const { html, stateScript } = await renderToString(jsx(App, {}))

const page = template
  .replace('<!--ssr-outlet-->', html)
  .replace('</body>', `  ${stateScript}\n</body>`)
```

`stateScript` is an inline `<script>` tag that sets `window.__STEWIE_STATE__` — a serialized payload of all registered store values. The client calls `hydrate()` to read this and initialize state without a second network round-trip.

## renderToStream

Streams the HTML shell immediately, then resolves `<Suspense>` boundaries progressively as async data loads.

```ts
import { renderToStream } from '@stewie-js/server'

const stream = renderToStream(jsx(App, {}))
return new Response(stream, {
  headers: { 'content-type': 'text/html; charset=utf-8' },
})
```

## Hydration Registry

Use the hydration registry to collect server-side state and serialize it into `__STEWIE_STATE__`. Components call `useHydrationRegistry()` to register values; the renderer serializes them automatically.

```ts
import { createHydrationRegistry, HydrationRegistryContext } from '@stewie-js/server'
import { provide } from '@stewie-js/core'

const registry = createHydrationRegistry()

const { html, stateScript } = await renderToString(
  provide(HydrationRegistryContext, registry, () => jsx(App, {}))
)
```

## API

| Export | Description |
|---|---|
| `renderToString(element, options?)` | Renders to `{ html: string, stateScript: string }` |
| `renderToStream(element, options?)` | Renders to a streaming `ReadableStream` |
| `createHydrationRegistry()` | Creates a registry that collects state for `__STEWIE_STATE__` |
| `HydrationRegistryContext` | Context token — provide the registry to the component tree |
| `useHydrationRegistry()` | Read the registry from inside a component |
| `RenderResult` | Type: `{ html: string, stateScript: string }` |
