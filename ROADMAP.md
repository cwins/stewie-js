# Stewie Roadmap

This document tracks genuine open items and planned enhancements. It is intentionally kept honest: things are only listed here if they are actually missing or incomplete in the current codebase.

---

## What Is Already Implemented

These exist and work — not listed as open items below.

| Feature | Package | Notes |
|---|---|---|
| `signal`, `computed`, `effect`, `store`, `batch` | `@stewie-js/core` | Fully implemented and exported |
| `signal.peek()` | `@stewie-js/core` | Read without subscribing |
| `Show`, `For`, `Switch`/`Match` | `@stewie-js/core` | DOM renderer handles all four |
| `For` keyed reconciliation | `@stewie-js/core` | LIS-based minimal DOM moves |
| `Portal`, `ErrorBoundary`, `Suspense`, `ClientOnly` | `@stewie-js/core` | DOM renderer and SSR renderer handle all |
| `lazy()` | `@stewie-js/core` | Code-split components with signal-driven loading |
| Context (`createContext`, `inject`, `provide`) | `@stewie-js/core` | Full implementation |
| `createRoot()` effect ownership | `@stewie-js/core` | Synchronous effects tracked and disposed on unmount |
| `renderToString` | `@stewie-js/server` | Working with hydration state injection |
| `renderToStream` | `@stewie-js/server` | Progressive streaming with Suspense boundary flushing |
| Hydration mismatch detection | `@stewie-js/core` | Dev-mode warning in `hydrate.ts` |
| View Transitions | `@stewie-js/router` | `document.startViewTransition` wrapping in router |
| Client-side routing, `<Link>` | `@stewie-js/router` | History + Navigation API, parameterized routes |
| Route guards (`beforeEnter`) | `@stewie-js/router` | Async allow/redirect on `navigate()` |
| Route-level data loading (`load`) | `@stewie-js/router` | Async loader result via `useRouteData()` |
| Router listener teardown | `@stewie-js/router` | `_dispose()` wired into `Router` component unmount |
| Route guards on initial render | `@stewie-js/router` | `beforeEnter` and `load` run before content shows; `fallback` prop for loading state |
| Route guards on back/forward | `@stewie-js/router` | `popstate` and Navigation API intercept handlers run guards before applying location |
| `$prop` two-way binding transform | `@stewie-js/compiler` | `$value`, `$checked` with conflict detection |
| Compiler auto-wrap | `@stewie-js/compiler` | Signal reads in JSX auto-wrapped in `() =>` |
| `effect` import injection | `@stewie-js/compiler` | Merged into existing core imports, or prepended if none |
| Fine-grained reactive output | `@stewie-js/compiler` | Native JSX → `createElement` + per-attribute `effect()` subscriptions; `key`, `ref`, `style`, complex reactive expressions (`count() + 1`) all handled |
| Source maps | `@stewie-js/compiler` | Inline (dev) and external `.map` (prod) |
| Node and Bun adapters | `@stewie-js/adapter-node/bun` | Thin HTTP adapter wrappers |
| Vite plugin + HMR | `@stewie-js/vite` | TSX transform, devtools injection |
| Devtools panel | `@stewie-js/devtools` | Renders, Stores, Routes tabs |
| Testing utilities | `@stewie-js/testing` | `mount`, query helpers, signal assertions |
| `create-stewie` CLI | `create-stewie` | Static and SSR scaffolding with router option |
| `resource()` primitive | `@stewie-js/core` | Signals (`data`, `loading`, `error`), `read()` for Suspense, `refetch()` |

---

## Open Items

Genuine gaps in the current implementation.

### Foundational (High Priority)

**True hydration / DOM reuse**
`hydrate()` currently delegates to `mount()`, which clears the container and re-renders from scratch. Real hydration should walk the existing SSR DOM and attach reactive subscriptions to existing nodes rather than discarding and recreating them. This is the largest gap in the SSR story and is architecturally significant work.

**`createRoot()` async ownership**
Synchronous effects created during a `createRoot()` body are now tracked and disposed on unmount. What remains: effects created from async callbacks (after `await`) are not automatically owned by the root and will not be disposed with it. A fully async-aware ownership tree (closer to Solid's `createOwner` semantics) is needed for long-lived async workflows.

**Route guards and data loading during SSR**
`beforeEnter` and `load` now run on initial client render and on browser back/forward navigation. They do not yet run during SSR (`renderToString`). An SSR guard redirect requires Suspense + `resource()` integration so the async result can be awaited inside the render pipeline. Until then, apps that need SSR guard redirects should run guards before calling `renderToString` and return an HTTP redirect response from their server handler.

### Router

**Typed params and query**
`useParams<{ id: string }>()` and `useQuery<{ tab: string }>()` with types inferred from route definitions rather than requiring manual annotation.

### Adapters

**`@stewie-js/adapter-cloudflare`**
Cloudflare Workers and Pages adapter. Workers speak `Request`/`Response` natively so the core logic is thin, but the streaming path needs validation in that environment.

**`@stewie-js/adapter-deno`**
`Deno.serve` adapter, similar in scope to the existing Bun adapter.

---

## Potential Enhancements

Things not strictly missing but that would meaningfully improve the project.

### Store proxy identity

Nested store objects are re-proxied on each property access with no caching layer. Referential identity is unstable across accesses, which can cause unnecessary effect re-runs. A WeakMap proxy cache would fix this.

### DevTools

- **Component tree tab** — live component hierarchy with signal subscription counts per node
- **Signal graph visualization** — dependency graph showing which signals feed which computed values and effects
- **Time-travel debugging** — snapshot signal/store state at each write, step backwards through history
- **Browser extension** — move the overlay panel into a proper Chrome/Firefox DevTools extension to eliminate z-index and layout interference

### Developer Experience

- **VS Code extension** — syntax highlighting for `$prop` bindings, signal/computed/store autocomplete, inline compiler diagnostics
- **ESLint plugin** — rules for signals read outside reactive scope, missing `createRoot`, module-scope reactive primitive creation
- **`stewie upgrade` CLI** — automates `@stewie-js/*` version bumps across a project's `package.json`
- **More `create-stewie` templates** — full-stack template with API routes, minimal no-router template, SSR+auth example demonstrating route guards

### Runtime

- **Form primitives** — `createForm({ fields, validate })` returning per-field signals, dirty/touched state, and a submit handler
- **Animation utilities** — thin reactive wrappers over the Web Animations API driven by signal values
- **Island architecture / partial hydration** — ship zero client JS by default, opt specific components into hydration at the boundary level

### Infrastructure

- **`@stewie-js/webpack`** — Webpack 5 plugin wrapping the compiler
- **Benchmark suite** — automated benchmarks against React, Vue, Solid, and Svelte on the js-framework-benchmark table to give a factual basis for performance claims
- **Documentation site** — API reference, guides (SSR setup, routing, reactivity deep-dive), and interactive examples
- **Conformance CI** — example apps that must pass `build`, `typecheck`, `test`, and SSR/hydration verification on every PR

---

## Priority Order

1. ~~True hydration / DOM reuse~~ — done
2. ~~Route guards and data loading on initial render~~ — done (client); SSR guard execution remains
3. ~~`resource()` primitive~~ — done
4. Route guards and data loading during SSR — required for complete auth flows
5. `createRoot()` async ownership — correctness for async-heavy apps
6. ~~Fine-grained compiler output~~ — done
7. Form primitives — highest-value DX enhancement
7. Documentation site — needed before recommending Stewie to others
