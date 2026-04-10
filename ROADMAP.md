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
| `reactiveScope()` effect ownership | `@stewie-js/core` | Synchronous effects and computed nodes tracked and disposed on unmount |
| `renderToString` | `@stewie-js/server` | Working with hydration state injection |
| `renderToStream` | `@stewie-js/server` | Progressive streaming with Suspense boundary flushing |
| True hydration / DOM reuse | `@stewie-js/core` | `_hydrateInto()` walks existing SSR DOM via `HydrationCursor`; reactive subscriptions attach to existing nodes |
| Hydration mismatch detection | `@stewie-js/core` | Dev-mode warning in `hydrate.ts` |
| View Transitions | `@stewie-js/router` | `document.startViewTransition` wrapping in router |
| Client-side routing, `<Link>` | `@stewie-js/router` | History + Navigation API, parameterized routes |
| Route guards (`beforeEnter`) | `@stewie-js/router` | Async allow/redirect on `navigate()` |
| Route-level data loading (`load`) | `@stewie-js/router` | Async loader result via `useRouteData()`; `_routeData` resets to `undefined` on every route change so stale data never bleeds into routes without a loader |
| Router listener teardown | `@stewie-js/router` | `_dispose()` wired into `Router` component unmount |
| Route guards on initial render | `@stewie-js/router` | `beforeEnter` and `load` run before content shows; `fallback` prop for loading state |
| Route guards on back/forward | `@stewie-js/router` | `popstate` and Navigation API intercept handlers run guards before applying location; guard redirects re-enter `navigate()` so the redirect target's own guards/loaders run |
| `$prop` two-way binding transform | `@stewie-js/compiler` | `$value`, `$checked` with conflict detection |
| Compiler auto-wrap | `@stewie-js/compiler` | Signal reads in JSX auto-wrapped in `() =>` |
| `effect` import injection | `@stewie-js/compiler` | Merged into existing core imports, or prepended if none |
| Fine-grained reactive output | `@stewie-js/compiler` | Native JSX → `createElement` + per-attribute `ComputedNode`-memoized `effect()` subscriptions; `key`, `ref`, `style`, complex reactive expressions (`count() + 1`) all handled |
| Source maps | `@stewie-js/compiler` | Inline (dev) and external `.map` (prod) |
| Node and Bun adapters | `@stewie-js/adapter-node/bun` | Thin HTTP adapter wrappers |
| Vite plugin + HMR | `@stewie-js/vite` | TSX transform, devtools injection |
| Devtools panel | `@stewie-js/devtools` | Renders tab (component names, old→new values, caller frames, anchor highlighting for Show/For/Switch), Stores tab, Routes tab, Graph tab (live signal dep visualization, disposal tracking) |
| Testing utilities | `@stewie-js/testing` | `mount`, query helpers, signal assertions |
| `create-stewie` CLI | `create-stewie` | Static and SSR scaffolding with router option |
| `resource()` primitive | `@stewie-js/core` | Signals (`data`, `loading`, `error`), `read()` for Suspense, `refetch()` |

---

## Open Items

Genuine gaps in the current implementation.

### Foundational (High Priority)

~~**`reactiveScope()` async ownership**~~
`getOwner()` and `runInOwner(owner, fn)` are now public APIs. Capture the owner before the first `await` in an async `reactiveScope` body, then pass it to `runInOwner` in async continuations so effects and `onCleanup` calls are registered with the root. This is the manual equivalent of Solid's `AsyncLocalStorage`-based ownership; fully automatic async propagation requires `AsyncLocalStorage` which is not available in all WinterCG environments.

~~**Route guards and data loading during SSR**~~
`createSsrRouter(url, routes)` runs `beforeEnter` guards and `load` functions before `renderToString`. Throws `RedirectError` (catch it in the server handler, return HTTP 302) when a guard redirects. Pass the returned router via `<Router router={ssrRouter}>` so the pre-loaded `_routeData` and correct location are available during the render.

~~**SSR renderer consistency (`renderToString` / `renderToStream`)**~~
Both renderers now emit identical boundary/anchor comment semantics (`<!---->`, `<!--Show-->`, `<!--For-->`, `<!--Switch-->`, `<!--Lazy-->`), including Signal child folding. Verified by `packages/server/src/renderer-consistency.test.ts` (26 tests).

~~**`resource()` cancellation / abort lifecycle**~~
`AbortController` integrated: fetcher receives an `AbortSignal`; signal is cancelled on `refetch()` and on owning scope disposal (via `onCleanup`). Stale results are silently dropped. `onCleanup()` is now a public API usable by application code as well.

### Router

~~**Router SPI enhancements**~~
`NavigationPhase`, `NavigationStatus`, `dismiss()`, and `preload()` added to `@stewie-js/router-spi` and implemented in `@stewie-js/router`. `useNavigationStatus()` exported from the router.

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

### DevTools

- **Component tree tab** — live component hierarchy with signal subscription counts per node
- **Signal graph visualization** — dependency graph showing which signals feed which computed values and effects ✓ shipped (Graph tab, text-based dep tree)
- **Time-travel debugging** — snapshot signal/store state at each write, step backwards through history
- **Browser extension** — move the overlay panel into a proper Chrome/Firefox DevTools extension to eliminate z-index and layout interference

### API Naming

- ~~**`inject` → `consume`**~~ — Renamed. `consume(Context)` pairs with `provide(Context, value)`.
- **Don't call `use*` functions "hooks"** — `useParams()`, `useQuery()` etc. are utility functions that follow a `use*` naming convention for discoverability. They are not hooks in the React sense: no call-order dependency, no linter rules, can be called conditionally. Docs should say "utility functions" or just "functions", never "hooks". Using "hooks" would mislead React developers into applying rules that don't exist in Stewie.

### Compiler

- **Compiler Bug 1 — over-eager reactive wrapping** — `containsNoArgIdentifierCall` is too broad: `{row().id}` gets wrapped as reactive even though `.id` returns a plain `number`. The correct fix requires `ts.createProgram` in the compiler pipeline to distinguish `Signal<T>` return types from plain values. Currently deferred; impacts generated code size and effect count but not correctness.

### Developer Experience

- ~~**`_appMounted` flag**~~ — `mount()` now calls `_setAppMounted()` which suppresses the "outside reactive scope" warning after mount. SSR-safety is preserved (warning still fires on server before any mount).
- **VS Code extension** — syntax highlighting for `$prop` bindings, signal/computed/store autocomplete, inline compiler diagnostics
- **ESLint plugin** — rules for signals read outside reactive scope, module-scope reactive primitive creation
- **`stewie upgrade` CLI** — automates `@stewie-js/*` version bumps across a project's `package.json`
- **More `create-stewie` templates** — full-stack template with API routes, minimal no-router template, SSR+auth example demonstrating route guards

### Runtime

- **Form primitives** — `createForm({ fields, validate })` returning per-field signals, dirty/touched state, and a submit handler
- **Animation utilities** — thin reactive wrappers over the Web Animations API driven by signal values
- **Island architecture / partial hydration** — ship zero client JS by default, opt specific components into hydration at the boundary level

### Infrastructure

- **`@stewie-js/webpack`** — Webpack 5 plugin wrapping the compiler
- **Benchmark results** — the js-framework-benchmark implementation exists (`examples/js-framework-benchmark`). Self-reported local numbers aren't credible; the right path is submitting a PR to the js-framework-benchmark repo to get included in their published results table. Defer until Stewie is stable enough to want the public visibility.
- **Documentation site** — API reference, guides (SSR setup, routing, reactivity deep-dive), and interactive examples
- **Conformance CI** — example apps that must pass `build`, `typecheck`, `test`, and SSR/hydration verification on every PR

### Edge-First Testing (phased)

Phase 1 is done: `scripts/check-edge-packages.mjs` (static Node-API guardrail for `packages/server` and `packages/router`), and `packages/server/src/edge-contract.test.ts` (Web API contract tests + `renderToString`/`renderToStream` parity). Remaining phases:

- **Phase 2 — streaming confidence**: focused `Suspense` streaming tests (shell arrives before deferred content, state script placement, multiple boundary ordering); timing-insensitive via controlled promise resolution
- **Phase 3 — full framework behavior**: router/guard/loader edge-flow tests (guard redirect → HTTP 302 at handler level, query/param propagation from `Request.url`, SSR route data in rendered HTML); `packages/router/src/ssr-edge.test.ts`
- **Phase 4 — adapter conformance**: shared parameterized conformance suite run against both the Node and Bun adapters; `packages/adapter-node/src/conformance.test.ts` and `packages/adapter-bun/src/conformance.test.ts`; extend to Cloudflare/Deno adapters when those packages exist

Phases 2–4 are deferred until Phase 1 proves stable and until `resource()` cancellation (a prerequisite for meaningful streaming tests) is implemented.

---

## Priority Order

1. ~~True hydration / DOM reuse~~ — done
2. ~~Route guards and data loading on initial render~~ — done (client); SSR guard execution remains
3. ~~`resource()` primitive~~ — done
4. ~~`_routeData` stickiness / redirect-on-back guard bypass~~ — done
5. ~~Fine-grained compiler output~~ — done
6. ~~`ComputedNode` ownership and reactive prop memoization~~ — done
7. ~~SSR renderer consistency (`renderToString` / `renderToStream`)~~ — done (26-test consistency suite)
8. ~~`resource()` cancellation / abort lifecycle~~ — done
9. ~~Route guards and data loading during SSR~~ — done
10. ~~`reactiveScope()` async ownership~~ — done (getOwner / runInOwner; renamed from createRoot)
11. ~~DevTools improvements~~ — done (Graph tab, signal disposal, component names on render entries, old→new values, caller frames, anchor highlighting for Show/For/Switch)
12. ~~Router SPI enhancements~~ — done (NavigationPhase, NavigationStatus, dismiss, preload, useNavigationStatus)
13. ~~`_appMounted` flag~~ — done (`mount()` calls `_setAppMounted()`, suppresses scope warnings post-mount)
14. **Conformance CI — layers 2 and 3** — scaffold ships with test files; conformance suite now runs vitest (layer 2) and vite build (layer 3) for all six combinations
15. **Compiler Bug 1** — over-eager reactive wrapping (needs ts.createProgram)
16. **Scaffold — Vitest browser mode tests** — dev and prod browser test passes for all scaffold variants (Vitest browser mode + Playwright provider)
17. **Canonical reference app (Work Queue) — Phase 1** — SSR app shell, route table, local data repo, dashboard + projects list
18. **Form primitives** — highest-value DX enhancement
19. **Documentation site** — needed before recommending Stewie to others
20. Edge-first testing phases 2–4
21. Cloudflare adapter
22. Typed route params and query
