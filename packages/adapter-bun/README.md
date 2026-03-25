# @stewie-js/adapter-bun

> **Work in progress.** APIs may change between releases.

Bun HTTP adapter for Stewie. Since Bun's `Bun.serve()` natively speaks `Request` / `Response`, this adapter is a thin wrapper that connects your Stewie app handler to `Bun.serve()`.

Part of the [Stewie](https://github.com/YOUR_ORG/stewie-js) framework.

## Install

```bash
pnpm add @stewie-js/adapter-bun @stewie-js/server @stewie-js/core
```

## Usage

```ts
import { createBunHandler } from '@stewie-js/adapter-bun'
import { renderToString } from '@stewie-js/server'
import { jsx } from '@stewie-js/core'
import App from './App.js'

const template = Bun.file('dist/client/index.html').text()

const fetch = createBunHandler(async (req) => {
  const { html, stateScript } = await renderToString(jsx(App, {}))
  const page = (await template)
    .replace('<!--ssr-outlet-->', html)
    .replace('</body>', `  ${stateScript}\n</body>`)
  return new Response(page, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
})

Bun.serve({ port: 3000, fetch })
console.log('Listening on http://localhost:3000')
```

## API

| Export | Description |
|---|---|
| `createBunHandler(app)` | Wraps a `(Request) => Promise<Response>` function for use with `Bun.serve()` |
| `StewieApp` | Type: `(request: Request) => Promise<Response>` |
| `BunServeOptions` | Type: serve options returned by `createBunHandler` |
