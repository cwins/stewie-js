# @stewie-js/adapter-cloudflare

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

Cloudflare Workers adapter for Stewie. Workers natively speaks the Web `Request` / `Response` API, so this adapter is a thin wrapper that connects your Stewie app handler to the Module Worker `fetch` entry.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add @stewie-js/adapter-cloudflare
```

The example below also uses `@stewie-js/server` and `@stewie-js/core`, which are a common pairing but not required by the adapter itself — it works with any handler that accepts a `Request` and returns a `Response`.

## Usage

```ts
// worker.ts
import { createCloudflareHandler } from '@stewie-js/adapter-cloudflare'
import { renderToString } from '@stewie-js/server'
import { jsx } from '@stewie-js/core'
import App from './App.js'
import template from './index.html'

export default createCloudflareHandler(async (req) => {
  const { html, stateScript } = await renderToString(jsx(App, {}))
  const page = template
    .replace('<!--ssr-outlet-->', html)
    .replace('</body>', `  ${stateScript}\n</body>`)
  return new Response(page, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
})
```

`wrangler.toml`:

```toml
name = "my-stewie-app"
main = "worker.ts"
compatibility_date = "2026-01-01"
```

## API

| Export | Description |
|---|---|
| `createCloudflareHandler(app)` | Returns a Module Worker default export object with a `fetch` method, ready to `export default` from your worker entry |
| `StewieApp` | Type: `(request: Request) => Response \| Promise<Response>` |
| `CloudflareWorker` | Type: the Module Worker shape returned by `createCloudflareHandler` |
| `CloudflareExecutionContext` | Minimal local type for Cloudflare's `ExecutionContext` (no peer dependency on `@cloudflare/workers-types`) |

Unhandled errors thrown by the app handler are caught, logged to `console.error`, and converted to a `500` response automatically.

## Accessing `env` and `ctx`

`env` (bindings: KV, R2, D1, secrets, env vars) and `ctx` (with `waitUntil` and `passThroughOnException`) are accepted by the returned `fetch` to satisfy the Module Worker contract, but are not yet plumbed through to the Stewie app handler. This is a v1 limitation — a broader context-propagation design is needed first so the access pattern is consistent across runtimes.

If you need `env` or `ctx` today, wrap the returned handler:

```ts
const handler = createCloudflareHandler(app)

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    // do something with env or ctx here, e.g. ctx.waitUntil(logAccess(req))
    return handler.fetch(req, env, ctx)
  }
}
```
