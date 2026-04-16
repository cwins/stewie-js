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

- ~~**Compiler Bug 1 — over-eager reactive wrapping**~~ — Fixed. `analyzeFile` accepts an optional `ts.TypeChecker`; the new `containsSignalRead` function checks callee types (callable + `.peek()` = Signal/Computed) rather than relying on syntax alone. `{row().id}` no longer wraps when `id: number`; `{row().label()}` still wraps when `label: Signal<string>`. Heuristic fallback preserved for plain JS. Vite plugin lazily creates a `ts.Program` from the project tsconfig and passes it to `compile()`.

### Actions / Mutations

Route loaders cover the read side. The write side — a blessed way to express mutations, pending/error/success state, validation, and cache invalidation after a write — is still missing. This is a genuine gap: without it every team builds their own ad hoc pattern.

This could live as an extension of `@stewie-js/router` / `@stewie-js/server` or as `@stewie-js/actions`. The design should be settled during the canonical Work Queue app, where real mutation use cases will surface the right shape before the API is committed.

### Decision-Oriented Docs

API reference is table stakes. What Stewie actually needs is "the Stewie way" — opinionated answers to questions like:

- Use `signal` when... vs `store` when... vs `resource` when...
- Use route `load` when... vs `resource()` inside a component when...
- Use `Show` function children when...
- Structure mutations this way...
- Handle optimistic updates this way...

These guides are more valuable than a complete API listing. They turn a technically capable framework into one that people can learn confidently and use consistently.

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

### Head / Metadata

Not a separate package — a runtime primitive in `@stewie-js/core` and an SSR extension in `@stewie-js/server`.

**Client side:** `useTitle`, `useMeta`, and a `<Head>` component are signal-driven mutations to `document.head`. When the signal changes, only the affected `<title>` or `<meta>` element updates — no re-render, no framework coordination. A lazy component that fetches data and then updates the title is unremarkable: it's just a signal write that happens to target `document.head`. The update fires whenever the data resolves, not at any earlier "phase."

**Server side (streaming):** Head content that is known before the stream starts (route-level title, canonical URL, OG tags from the loader) is emitted in `<head>` in the shell. Head content produced inside a Suspense boundary (a lazy component that derives its title from fetched data) travels inline with that boundary's HTML flush as a small `<script>document.title = '...'</script>`. No two-pass render, no pre-render collection step, no library wrapping `renderToString`.

**Why not a separate package:** Head management is a direct expression of signal-driven DOM mutations. It belongs in core alongside `effect()` and `Portal`. A separate package would just re-export the same primitives with extra indirection.

### Progressive Asset Streaming

This is an enhancement to `@stewie-js/vite` (build time) and `@stewie-js/server` (render time), not a new package or a developer-facing API.

**The problem it solves:** In the React ecosystem, CSS-in-JS libraries, icon libraries, and UI component packages each need to "collect" their stylesheets during SSR. Because React gives no participation point inside the render, they must wrap `renderToString` themselves — multiple libraries fight over render ownership, and the result is incompatible with streaming because collection requires completing the render before emitting anything. The same problem applies to JS bundles for lazy-loaded components: styles arrive late, causing flash of unstyled content on hydration.

**Critical constraint — client and server bundles diverge:** The server bundle and client bundle have meaningfully different dependency graphs. The server bundle typically elides CSS entirely (reducing CSS module imports to class-name mappings only) and does not produce the same chunk boundaries as the client build. Walking the server bundle's import graph therefore cannot yield CSS file paths or correct JS chunk references — those come from the client build. Any asset manifest must be built from client build artifacts.

**The Stewie approach:**

*Build order matters:* The client build runs first, producing CSS files, JS chunks, and `dist/client/manifest.json` with content-hashed filenames. The server build runs second with `ssrManifest: true`, cross-referencing the client manifest to produce `dist/server/ssr-manifest.json`. This file maps server-side module IDs to their corresponding client-side assets (CSS links, JS chunks, preload hints). This is Vite's existing mechanism — Stewie uses it rather than reimplementing it.

*Render time (`renderToStream`):* When a Suspense boundary for a `lazy()` component is about to flush, resolve the component's module ID against the ssr-manifest to find its client-side CSS and JS assets. Prepend `<link rel="stylesheet">` tags before the boundary's HTML chunk. The browser receives styles exactly when it receives the HTML that needs them — not before (wasted preload), not after (FOUC).

*Vite plugin's actual job:* Ensure `lazy()` boundaries capture and expose their module ID in a form the server renderer can resolve at runtime, and load the ssr-manifest into the render context. The cross-referencing between client and server artifacts is Vite's responsibility via `ssrManifest` — the plugin's job is narrow: connect `lazy()` boundaries to the manifest lookup.

*Hydration gating:* Before the client hydrates a boundary, both the CSS links and the JS chunk must be loaded. The `lazy()` import promise already gates on JS. CSS load events gate on the `<link>` tags emitted with the boundary flush.

**Why this is architecturally different:** Because `lazy()` is a first-class framework primitive and `renderToStream` already has a per-boundary flush hook, the ssr-manifest is a natural bridge between Vite's build-time output and the render-time boundary ordering. Libraries participate by importing CSS normally — they do not wrap the renderer.

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
14. ~~**Conformance CI — layers 2 and 3**~~ — done; scaffold ships with test files; conformance suite runs vitest (layer 2) and vite build (layer 3) for all six combinations
15. ~~**Compiler Bug 1**~~ — done (type-aware auto-wrap via ts.TypeChecker, heuristic fallback for plain JS)
16. ~~**Browser tests — ssr-and-routing example**~~ — done; 11 Playwright tests run against prod build via `test:browser`; scaffold browser test story deferred pending CI solution
17. **Canonical reference app (Work Queue) — Phase 1** — SSR app shell, route table, local data repo, dashboard + projects list; also the design testbed for actions/mutations and head/metadata patterns
18. **Documentation site + decision-oriented guides** — API reference plus "the Stewie way" guides (signal vs store vs resource, route load vs resource, mutation patterns, etc.)
19. **Form primitives** — `createForm()` with per-field signals, dirty/touched/valid/submitting state, field arrays, sync and async validation, server error integration
20. **Actions / mutations** — design to emerge from Work Queue; blessed write-side counterpart to route loaders
21. **Head / metadata + progressive asset streaming** — `useTitle`/`useMeta`/`<Head>` as signal-driven core primitives; Vite plugin component-to-assets manifest; per-boundary CSS emission in `renderToStream`; hydration gating on CSS + JS load
22. Edge-first testing phases 2–4
23. Cloudflare adapter
24. Typed route params and query
