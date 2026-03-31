# create-stewie

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

Project scaffolding CLI for Stewie. Generates a fully configured starter project with one command.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Usage

```bash
pnpm create stewie my-app
cd my-app
pnpm install
pnpm dev
```

The CLI prompts for:

- **Project name**
- **Mode** — `static` (client-only, fetches from external APIs) or `ssr` (server-rendered)
- **SSR runtime** (if SSR mode) — `node` or `bun`
- **Include router** — adds `@stewie-js/router` and example routes

## What gets generated

All modes include:
- `package.json` with the correct `@stewie-js/*` dependencies
- `vite.config.ts` with the `@stewie-js/vite` plugin
- `tsconfig.json` targeting ES2022
- `src/app.tsx` — root component with a working example
- `index.html` — HTML shell

SSR mode also includes:
- `src/server.ts` — server entry using the appropriate adapter
- `src/client.tsx` — client hydration entry
- `vite.config.ts` — configured with SSR build environments
- `start` script for running the production server

## Prerequisites

The generated `vitest.config.ts` sets `environment: 'happy-dom'`. You need to install `happy-dom` separately as a dev dependency in the generated project before running tests:

```bash
pnpm add -D happy-dom
```

## Non-interactive CLI flags

All prompts can be answered via flags for scripted or CI use:

```bash
pnpm create stewie my-app --mode=ssr --runtime=node --router
pnpm create stewie my-app --mode=static
```

| Flag | Values | Description |
|---|---|---|
| `--mode` | `static`, `ssr` | Project mode |
| `--runtime` | `node`, `bun` | SSR runtime (only used with `--mode=ssr`) |
| `--router` | boolean flag | Include `@stewie-js/router` and example routes |

## Programmatic API

```ts
import { scaffoldProject, generateFiles } from 'create-stewie'

const files = generateFiles({
  projectName: 'my-app',
  mode: 'ssr',
  ssrRuntime: 'node',
  includeRouter: true,
})

await scaffoldProject('./my-app', files)
```
