# create-stewie

> **Work in progress.** APIs may change between releases.

Project scaffolding CLI for Stewie. Generates a fully configured starter project with one command.

Part of the [Stewie](https://github.com/YOUR_ORG/stewie-js) framework.

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
- `src/App.tsx` — root component with a working example
- `index.html` — HTML shell

SSR mode also includes:
- `src/server.ts` — server entry using the appropriate adapter
- `src/client.tsx` — client hydration entry
- `vite.config.ts` — configured with SSR build environments
- `start` script for running the production server

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
