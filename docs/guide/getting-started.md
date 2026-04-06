# Getting Started

Stewie is a TypeScript web framework built on fine-grained signals. Components subscribe directly to the reactive values they use — there is no virtual DOM to diff.

---

## Scaffold a new project

```bash
pnpm create stewie my-app
cd my-app
pnpm install
pnpm dev
```

The CLI will ask:

- **Mode** — `static` (client-only, fetches from external APIs) or `ssr` (Node.js or Bun server)
- **SSR runtime** — `node` or `bun` (only if you chose `ssr`)
- **Include router** — adds `@stewie-js/router`

---

## Manual setup

If you prefer to set up by hand:

```bash
pnpm add @stewie-js/core @stewie-js/vite
pnpm add -D typescript vite vitest
```

**`vite.config.ts`**

```ts
import { stewie, defineConfig } from '@stewie-js/vite'

export default defineConfig({
  plugins: [stewie()]
})
```

**`tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "@stewie-js/core"
  }
}
```

The `@stewie-js/vite` plugin sets `jsx` and `jsxImportSource` automatically — you only need the `tsconfig.json` entries if you want IDE support without running the dev server.

---

## Your first component

```tsx
// src/main.tsx
import { signal } from '@stewie-js/core'
import { mount } from '@stewie-js/core'

function Counter() {
  const count = signal(0)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => count.update(n => n + 1)}>+</button>
    </div>
  )
}

mount(<Counter />, document.getElementById('app')!)
```

```html
<!-- index.html -->
<!doctype html>
<html>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`count` is passed directly as a JSX child — Stewie subscribes that text node to the signal automatically. Only the text node updates when `count` changes; nothing else re-renders.

---

## Next steps

- [Reactivity](reactivity.md) — understand signals, computed, effects, and the store
- [Components](components.md) — writing components, JSX, control flow, and context
- [Routing](routing.md) — client-side and SSR routing
- [Server-Side Rendering](ssr.md) — renderToString, streaming, and hydration
