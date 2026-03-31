# @stewie-js/server

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

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

`stateScript` is an inline `<script>` tag that sets `window.__STEWIE_STATE__` — a serialized payload of all hydration registry key/value pairs collected during the render. The client calls `hydrate()` to read this and initialize state without a second network round-trip.

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

`renderToString` and `renderToStream` create their own internal hydration registry automatically. Components use `useHydrationRegistry()` from `@stewie-js/core` to register key/value pairs that get serialized into `__STEWIE_STATE__`.

```ts
import { useHydrationRegistry } from '@stewie-js/core'

function MyComponent() {
  const registry = useHydrationRegistry()
  if (registry) {
    registry.set('myKey', someServerData)
  }
  // ...
}
```

## CSP Nonce

Both renderers accept a `nonce` option. The nonce is applied to all injected `<script>` tags:

```ts
const { html, stateScript } = await renderToString(jsx(App, {}), { nonce: requestNonce })
const stream = renderToStream(jsx(App, {}), { nonce: requestNonce })
```

## API

| Export | Description |
|---|---|
| `renderToString(element, options?)` | Renders to `{ html: string, stateScript: string }` |
| `renderToStream(element, options?)` | Renders to a streaming `ReadableStream` |
| `RenderOptions` | Options type: `{ nonce?: string }` |
| `RenderResult` | Return type of `renderToString`: `{ html: string, stateScript: string }` |
