# @stewie-js/adapter-bun

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

Bun HTTP adapter for Stewie. Since Bun's `Bun.serve()` natively speaks `Request` / `Response`, this adapter is a thin wrapper that connects your Stewie app handler to `Bun.serve()`.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add @stewie-js/adapter-bun
```

The example above also uses `@stewie-js/server` and `@stewie-js/core`, which are a common pairing but not required by the adapter itself — it works with any handler that accepts a `Request` and returns a `Response`.

## Usage

```ts
import { createBunHandler } from '@stewie-js/adapter-bun'
import { renderToString } from '@stewie-js/server'
import { jsx } from '@stewie-js/core'
import App from './App.js'

const template = Bun.file('dist/client/index.html').text()

Bun.serve(createBunHandler(async (req) => {
  const { html, stateScript } = await renderToString(jsx(App, {}))
  const page = (await template)
    .replace('<!--ssr-outlet-->', html)
    .replace('</body>', `  ${stateScript}\n</body>`)
  return new Response(page, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}, { port: 3000 }))
console.log('Listening on http://localhost:3000')
```

## API

| Export | Description |
|---|---|
| `createBunHandler(app, options?)` | Returns a `BunServeOptions` object (including the `fetch` handler) ready to pass directly to `Bun.serve()` |
| `StewieApp` | Type: `(request: Request) => Response \| Promise<Response>` |
| `BunServeOptions` | Type: the serve-options object returned by `createBunHandler` |

Unhandled errors thrown by the app handler are caught, logged to `console.error`, and converted to a `500` response automatically.
