# Stewie Roadmap

This document tracks genuine open items and planned enhancements. It is intentionally kept honest: things are only listed here if they are actually missing or incomplete in the current codebase.

---

## What Is Already Implemented

These exist and work — not listed as open items below.

| Feature | Package | Notes |
|---|---|---|
| `signal`, `computed`, `effect`, `store`, `batch` | `@stewie-js/core` | Fully implemented and exported |
| `Show`, `For`, `Switch`/`Match` | `@stewie-js/core` | DOM renderer handles all four |
| `Portal`, `ErrorBoundary`, `Suspense`, `ClientOnly` | `@stewie-js/core` | DOM renderer and SSR renderer handle all |
| Context (`createContext`, `inject`, `provide`) | `@stewie-js/core` | Full implementation |
| `renderToString` | `@stewie-js/server` | Working with hydration state injection |
| `renderToStream` | `@stewie-js/server` | Progressive streaming with Suspense boundary flushing |
| Hydration mismatch detection | `@stewie-js/core` | Dev-mode warning in `hydrate.ts` |
| View Transitions | `@stewie-js/router` | `document.startViewTransition` wrapping in router |
| Client-side routing, `<Link>` | `@stewie-js/router` | History + Navigation API, parameterized routes |
| Node and Bun adapters | `@stewie-js/adapter-node/bun` | Thin HTTP adapter wrappers |
| Vite plugin + HMR | `@stewie-js/vite` | TSX transform, devtools injection |
| Devtools panel | `@stewie-js/devtools` | Renders, Stores, Routes tabs |
| Testing utilities | `@stewie-js/testing` | `mount`, query helpers, signal assertions |
| `create-stewie` CLI | `create-stewie` | Static and SSR scaffolding with router option |

---

## Open Items

Genuine gaps in the current implementation.

### Foundational (High Priority)

**True hydration / DOM reuse**
`hydrate()` currently delegates to `mount()`, which clears the container and re-renders from scratch. Real hydration should walk the existing SSR DOM and attach reactive subscriptions to existing nodes rather than discarding and recreating them. This is the largest gap in the SSR story and is architecturally significant work.

**`createRoot()` ownership and disposal**
`createRoot()` currently only guards against module-scope reactive primitive creation. It does not create an ownership tree, does not track child effects, and does not dispose them on component unmount. This means effects created inside component bodies accumulate and are never cleaned up, which is a correctness and memory concern for long-lived apps. A proper ownership model (closer to Solid's `createRoot` semantics) is needed.

**Router listener teardown**
`createRouter()` installs `popstate` or Navigation API event listeners but provides no teardown API. Repeated mount/unmount cycles — common in tests and microfrontend contexts — can accumulate process-global listeners.

### Compiler

**`$prop` two-way binding transform**
The spec is fully designed: `$value={sig}` expands to `value={sig()} onInput={e => sig.set(e.target.value)}`, with collision detection (error if `value` is also set) and readonly/disabled downgrade (warning + one-way). The transform is not yet wired into the emitter.

**`effect` import injection correctness**
When the compiler emits `effect(...)` calls into a file that already imports other things from `@stewie-js/core` but not `effect`, the import injection logic does not add the missing `effect` import. Files that start with zero `@stewie-js/core` imports work correctly; this is the edge case.

**Fine-grained reactive output**
The compiler currently handles JSX transformation and validation. The deeper optimization — statically distinguishing reactive vs. static JSX attribute expressions and emitting direct DOM subscriptions — is partially designed but not fully implemented in the emitter.

**Source maps**
Dev-mode inline source maps and production external `.map` files for compiled TSX output are not yet generated.

### Router

**Route guards**
Async `beforeEnter(to, from)` hook on route definitions that can redirect or block navigation. Essential for auth flows; not yet implemented.

**Lazy routes with code splitting**
`component: lazy(() => import('./Page'))` with automatic route-boundary code splitting. All routes are currently eagerly bundled.

**Typed params and query**
`useParams<{ id: string }>()` and `useQuery<{ tab: string }>()` with types inferred from route definitions rather than requiring manual annotation.

### Data and Async

**`resource()` primitive**
A `resource(fetcher)` primitive that wraps async functions and returns `{ data, loading, error }` signals. Integrates naturally with `<Suspense>` and route-level data loading. Currently users must manage loading state manually with signals.

**Route-level data loading**
A `load` function on route definitions that resolves before the component renders and integrates with `<Suspense>`. Eliminates the need for loading spinners inside page components.

### Adapters

**`@stewie-js/adapter-cloudflare`**
Cloudflare Workers and Pages adapter. Workers speak `Request`/`Response` natively so the core logic is thin, but the streaming path needs validation in that environment.

**`@stewie-js/adapter-deno`**
`Deno.serve` adapter, similar in scope to the existing Bun adapter.

---

## Potential Enhancements

Things not strictly missing but that would meaningfully improve the project.

### `For` keying

The `For` component accepts a `key` prop but the DOM renderer's list reconciliation may not be using it for minimal diffing. Worth auditing and hardening — unkeyed list teardown/rebuild on every change is the worst case for interactive lists.

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

1. True hydration / DOM reuse — biggest gap in the SSR story
2. `createRoot()` ownership and disposal — foundational correctness
3. Router listener teardown — correctness for test and embedded use
4. `$prop` compiler transform — already fully specced, needs wiring
5. `effect` import injection fix — compiler correctness bug
6. `resource()` + route-level data loading — unlocks real async patterns
7. Route guards + lazy routes — required for production auth and performance
8. Fine-grained compiler output — the core performance differentiator
9. Form primitives — highest-value DX enhancement
10. Documentation site — needed before recommending Stewie to others
