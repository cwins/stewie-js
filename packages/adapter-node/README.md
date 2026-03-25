# @stewie-js/adapter-node

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

Node.js HTTP adapter for Stewie. Bridges Node's `http.IncomingMessage` / `ServerResponse` to the standard Web `Request` / `Response` API that `@stewie-js/server` uses, so the same app handler works across Node, Bun, and other WinterCG runtimes.

Requires Node 18+.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add @stewie-js/adapter-node @stewie-js/server @stewie-js/core
```

## Usage

```ts
import { createNodeHandler } from '@stewie-js/adapter-node'
import { renderToString } from '@stewie-js/server'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { jsx } from '@stewie-js/core'
import App from './App.js'

const template = readFileSync('dist/client/index.html', 'utf-8')

const handler = createNodeHandler(async (req) => {
  const { html, stateScript } = await renderToString(jsx(App, {}))
  const page = template
    .replace('<!--ssr-outlet-->', html)
    .replace('</body>', `  ${stateScript}\n</body>`)
  return new Response(page, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
})

createServer(handler).listen(3000)
console.log('Listening on http://localhost:3000')
```

## API

| Export | Description |
|---|---|
| `createNodeHandler(app)` | Wraps a `(Request) => Promise<Response>` function into a `http.RequestListener` |
| `StewieApp` | Type: `(request: Request) => Promise<Response>` |
