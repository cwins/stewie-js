# @stewie-js/vite

> **Work in progress.** APIs may change between releases.

Vite plugin for Stewie. Configures the JSX transform to use `@stewie-js/core`'s runtime and wires up HMR.

Part of the [Stewie](https://github.com/YOUR_ORG/stewie-js) framework.

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

- Sets `jsxImportSource: '@stewie-js/core'` so `.tsx` files use Stewie's JSX runtime
- Enables HMR for Stewie components in development

## API

| Export | Description |
|---|---|
| `stewie(options?)` | Vite plugin factory |
| `defineConfig(config)` | Re-exported from Vite — use this instead of importing from `vite` directly |
| `defineStewieConfig(config?)` | Like `defineConfig` but adds the `stewie()` plugin automatically |
