# @stewie-js/vite

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

Vite plugin for Stewie. Configures the JSX transform to use `@stewie-js/core`'s runtime and wires up HMR.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add -D @stewie-js/vite
```

## Usage

```ts
// vite.config.ts
import { stewie, defineConfig } from '@stewie-js/vite'

export default defineConfig({
  plugins: [stewie()]
})
```

Or with additional Vite config:

```ts
import { stewie, defineConfig } from '@stewie-js/vite'

export default defineConfig({
  plugins: [stewie()],
  server: {
    port: 3000,
  },
})
```

## What it does

- Sets `jsxImportSource: '@stewie-js/core'` and `jsx: 'react-jsx'` so `.tsx` files use Stewie's JSX runtime
- Integrates with Vite's normal HMR flow for development
- In development mode, adds a dynamic import of `@stewie-js/devtools` — provided the package is installed in the project

## `jsxToDom` option

The `jsxToDom` compiler option controls whether JSX is transformed to fine-grained DOM calls. It defaults to `true` for client builds and is disabled automatically for SSR builds (Vite passes `ssr: true` to the transform hook).

```ts
stewie({ jsxToDom: false }) // disable for testing or custom integrations
```

## `defineConfig` vs `defineStewieConfig`

`defineConfig` is a direct re-export from Vite — it provides no Stewie-specific defaults and is included only for convenience.

`defineStewieConfig` is a Stewie helper that adds the `stewie()` plugin automatically, so you don't need to add it explicitly:

```ts
// equivalent to: defineConfig({ plugins: [stewie()] })
export default defineStewieConfig()

// with additional options
export default defineStewieConfig({
  server: { port: 3000 },
})
```

## API

| Export | Description |
|---|---|
| `stewie(options?)` | Vite plugin factory |
| `defineConfig(config)` | Re-export from Vite — same as importing from `vite` directly |
| `defineStewieConfig(config?)` | Like `defineConfig` but adds `stewie()` automatically |
