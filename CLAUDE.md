# Stewie — Project Context for Claude

This file is the canonical reference for the Stewie framework. Read it at the start of every session. It supersedes any stale memory files or plan documents.

---

## What Stewie Is

A small, coherent TypeScript web framework for modern runtimes. It covers reactivity, rendering, SSR, routing, a compiler, testing utilities, devtools, and scaffolding — all designed together as a whole rather than assembled from third-party pieces.

**Current version:** 0.9.0
**Package scope:** `@stewie-js/*`
**Monorepo manager:** pnpm workspaces

---

## What Stewie Is NOT

- Not a React replacement or anti-React project. Framing it that way is lazy and misleading.
- Not trying to be "the next Solid". Solid is an inspiration, not a target. If an individual primitive-level decision converges with Solid, that's fine — but the framework-level story (coherent full framework, WinterCG, first-party data story, explanatory devtools) must remain distinct. Watch for this: each fix that makes the primitives more like Solid's should be accompanied by a check that the framework-level differentiation is still clear.
- Not commodity signals with a branding coat. The differentiation is coherence + target environment, not primitive novelty.
- Not Node-specific. WinterCG compatibility is a genuine design constraint, not a marketing claim.
- Not another library with layers of bandaids. Stewie has the benefit of being new — get the API right from the start rather than evolving through accumulating complexity. MobX, RxJS, and similar libraries became hard to use because recipes had to be just right across many API layers. Stewie should never feel like that.

---

## The Four Bets (Differentiation)

These are the reasons Stewie exists rather than "just use X":

1. **Small full framework** — routing, SSR, testing, devtools, and compiler all fit together as a designed whole. No hunting for compatible third-party pieces or gluing ecosystems.

2. **WinterCG / edge-first** — `@stewie-js/core` and `@stewie-js/server` use only standard Web APIs (`Request`, `Response`, `ReadableStream`, etc.). No Node-specific APIs. Runs on Node, Bun, Cloudflare Workers, Deno without a shim layer.

3. **First-party data story** — route data loading → SSR state transfer (`__STEWIE_STATE__`) → true DOM-claiming hydration → clean client pickup. This is a coherent contract, not user-assembled.

4. **Explanatory devtools** — tooling that shows *what* updated, *why* it updated, and *what it subscribed to*, reinforcing the mental model rather than just exposing internal state.

---

## Core Design Decisions (and Why)

### No virtual DOM
**Decision:** The renderer produces real DOM directly. There is no diffing step.
**Why:** Fine-grained signals eliminate the need. Each reactive expression subscribes directly to the signals it reads. When a signal changes, only that expression's DOM node updates. There is nothing to diff because updates are already precisely targeted.

### Comment nodes as reactive anchors
**Decision:** Dynamic children (function children, Show, For, Switch) place an invisible `<!---->` comment in the DOM as a stable insertion marker.
**Why:** A reactive slot can render zero, one, or many nodes, and those nodes can change. Without a stable marker, the effect has no DOM reference to insert against when the previous render was empty or when siblings are also dynamic. The comment is inert to layout, invisible to users, and costs essentially nothing.

### Signals are scoped, not global
**Decision:** `signal()`, `computed()`, `effect()`, and `store()` must be called inside a component or `reactiveScope()` — never at module scope.
**Why:** Module-scope reactive primitives become accidental singletons shared across requests in SSR environments. The compiler enforces this as a hard error; the runtime warns in dev mode.

### Minimal API surface
**Decision:** Every public export must earn its place. Before adding a new exported function, check whether an existing one can cover the use case. Prefer one powerful primitive over two slightly different ones.
**Why:** Reactive and data libraries that export 30+ functions for overlapping concerns become exhausting to learn and easy to misuse. Users should be able to hold the entire API in their head. The gut check: if a new export does "almost the same thing" as an existing one, that's a signal to extend the existing one or find a different design — not to add another name.
**In practice:** When considering a new export, ask: (1) Can an existing API handle this with a small composition? (2) Is this needed by most users or only edge cases? (3) Does adding it make the docs page longer in a way that would intimidate a new user?

### Compiler is optional but is the complexity shield
**Decision:** The Vite compiler plugin (`@stewie-js/vite`) improves output but is not required. Plain JSX via `jsxImportSource` produces a fully working app.
**Why:** Not every project uses Vite. The runtime must work correctly without compiler transforms. Compiler improvements that only apply when the compiler is present are fine, but improvements that benefit both paths are always preferred.
**Design principle:** The developer writes simple, obvious code. The compiler is responsible for transforming it into the optimal fine-grained reactive output. Developers should not need to understand the optimization layer — `$prop` two-way binding, auto-wrapping signal reads in JSX, and breaking components into granular reactive pieces are all compiler concerns, not developer concerns. If an optimization requires the developer to write their code differently, that's a design failure.

### Signal child folding (dom-renderer)
**Decision:** When a function child returns a function (i.e., the compiler emits `() => item().label` where `label` is a `Signal<string>`), the dom-renderer calls through one level within the same effect rather than recursing into a nested `renderChildren` call.
**Why:** Prevents double-nesting: without folding, each such child creates two comment anchors and two effects. With folding, it creates one. This halved the anchor count in compiler output from 3 per row to 2 per row in the benchmark.

### Routing is built-in, not outsourced
**Decision:** Routing is a first-party framework concern, not left to the community. Guards, loaders, data loading, view transitions, and SSR integration all live in `@stewie-js/router`. The Router SPI (`@stewie-js/router-spi`) allows swapping implementations, but the default router is complete and production-grade.
**Why:** Routing is critical infrastructure for web apps. Leaving it to third parties creates ecosystem fragmentation (React's experience with react-router, TanStack Router, Next.js router, etc.) and forces users to verify compatibility between their router, their data layer, and their SSR setup. When the framework owns routing, the data loading → SSR → hydration pipeline can be a coherent contract. When a routing gap is found (e.g., layout routes), the answer is to build it into the router — not to suggest a workaround pattern.

### WinterCG boundary is hard
**Decision:** `packages/core` and `packages/server` must never import Node.js APIs.
**Why:** These packages run in edge environments. A single `import { readFileSync } from 'fs'` breaks Cloudflare Workers. `scripts/check-edge-packages.mjs` enforces this in CI via static analysis.

### Hydration claims existing DOM
**Decision:** `hydrate()` walks the server-rendered DOM via `HydrationCursor`, attaches reactive effects to existing nodes, and does not wipe and re-render.
**Why:** True hydration: ~0 DOM mutations on load, no layout thrash, faster TTI. Wipe-and-rerender throws away the server's work.

### Head / metadata is a signal-driven primitive, not a package
**Decision:** `useTitle`, `useMeta`, and `<Head>` will live in `@stewie-js/core`. On the client they are signal-driven mutations to `document.head` — an effect that writes `document.title` when a signal changes. On the server they register with the SSR render context and are emitted in `<head>` (if available before the shell closes) or inline as `<script>document.title = '...'</script>` alongside the Suspense boundary flush that produced them.
**Why:** Head management is a direct expression of signal-driven DOM mutation — the same primitive as any other reactive DOM update, just targeting `document.head`. There is no "collection phase" and no two-pass render. A lazy component that derives a page title from fetched data updates `document.title` when its data resolves, the same way it would update any other DOM node. Treating this as a separate package would add indirection without adding capability.

### One registry primitive for SSR replay and client-side cache
**Decision:** Resource data, route loader data, and any future cache-like state share one underlying primitive: a `DataRegistry` interface (`has`/`get`/`set`/`serialize`/`serializeByKey`/`hydrate`/`hydrateByKey`) backed by a reactive `store()`. SSR emits `serializeByKey` payloads inline near each consuming component (not in a single end-of-stream blob); hydration calls `hydrateByKey` to seed the registry; `useResource` checks the registry first on every call.
**Why:** Two registries — one for SSR replay, one for client cache — would have been the wrong shape; they're functionally the same thing with different delivery. A keyed registry IS a flat store, so backing it with `store()` gives reactive cache invalidation, devtools inspection, and a single mental model for free. Inline-near-consumer placement (rather than end-of-stream serialization) preserves progressive hydration: each Suspense boundary's data lands with its content, so hydration of an early boundary doesn't wait for `__STEWIE_STATE__` at end-of-stream. Multi-instance components dedupe naturally because the cursor disambiguates payloads by DOM position. Cache features that aren't needed yet (TTL, manual invalidation, refetch on focus, prefetch, background revalidation) layer onto the same primitive without breaking the contract.
**In practice:** Key derivation is `${defId}:${stableSerialize(args)}` — `defineResource` attaches a stable id when called; args are serialized deterministically. Three components calling the same `useResource(fetchUser, () => 1)` share one fetch through the same registry entry. Back-navigation reusing recent results works as long as the registry hasn't been cleared (lifetime: app instance). Loaders and resources currently write under different key namespaces (`route:${path}:${paramsHash}` vs `${defId}:${argsHash}`) — long-term, loaders will be expressed *via* `defineResource` so they share identity with components calling the same resource, but that's a future refactor that doesn't break the current SPI. **Elevated 2026-07-06** (React/Solid comparison review): this unification is load-bearing for the "first-party data story" bet, not a nice-to-have. Until a loader and a `useResource` hitting the same endpoint dedupe through one registry entry, the data layer only *looks* unified — it's two namespaces in one store. Tracked in ROADMAP under "SSR + Hydration Correctness".

### Progressive asset streaming is automatic, not a developer API
**Decision:** The Vite plugin walks the import graph from each `lazy()` entry point at build time and emits a component-to-assets manifest (CSS modules and JS chunks per lazy boundary). `renderToStream` uses this manifest to prepend `<link rel="stylesheet">` tags before each Suspense boundary's HTML flush. Client hydration gates on those CSS links being loaded before the boundary is hydrated.
**Why:** The root cause of the React ecosystem's SSR asset pain (styled-components, Apollo, etc.) is that libraries must wrap `renderToString` to collect their assets — because React gives no participation point inside the render. This breaks streaming. Stewie avoids this entirely: `lazy()` is a first-class primitive, `renderToStream` already has a per-boundary flush hook, and the Vite plugin already sees the full import graph. These three things compose naturally into automatic asset emission with no developer ceremony. Libraries import CSS normally; the framework handles ordering and delivery.

---

## Package Map

| Package | Name | Role |
|---|---|---|
| `packages/core` | `@stewie-js/core` | Reactivity primitives, JSX runtime, DOM renderer, SSR renderer, hydration, control flow components, context, resource |
| `packages/compiler` | `@stewie-js/compiler` | TSX → fine-grained reactive output, `$prop` two-way binding, module-scope validation |
| `packages/vite` | `@stewie-js/vite` | Vite plugin wrapping the compiler, HMR, devtools injection |
| `packages/server` | `@stewie-js/server` | `renderToString`, `renderToStream`, SSR router entry |
| `packages/router` | `@stewie-js/router` | Client router, `<Link>`, `useParams`, `useQuery`, route guards, data loading, SSR router |
| `packages/router-spi` | `@stewie-js/router-spi` | Interface-only SPI for swappable router implementations |
| `packages/adapter-node` | `@stewie-js/adapter-node` | Node.js HTTP adapter |
| `packages/adapter-bun` | `@stewie-js/adapter-bun` | Bun HTTP adapter |
| `packages/adapter-cloudflare` | `@stewie-js/adapter-cloudflare` | Cloudflare Workers Module Worker adapter |
| `packages/devtools` | `@stewie-js/devtools` | Floating panel: Renders, Stores, Routes, Graph tabs |
| `packages/testing` | `@stewie-js/testing` | `mount`, query helpers, signal/store assertions, SSR test helper |
| `packages/create-stewie` | `create-stewie` | `pnpm create stewie` scaffolding CLI |

---

## What Is Implemented and Real Today

- `signal`, `computed`, `effect`, `store`, `batch`, `untrack`, `onCleanup`, `getOwner`, `runInOwner`
- `defineResource(fn)` + `useResource(def, source)` with `AbortController` cancellation
- `defineAction(fn)` + `useAction(def)` with `pending`, `error`, `lastRun`, `reset`
- `Show`, `For` (keyed, LIS-based), `Switch`/`Match`, `Portal`, `ErrorBoundary`, `Suspense`, `ClientOnly`, `lazy()`
- Context (`createContext`, `provide`, `consume`)
- `renderToString` and `renderToStream` (streaming with progressive Suspense flushing)
- `useTitle`, `useMeta`, `<Head>` — signal-driven head/metadata primitives; `renderToString` returns `headHtml`; `renderToStream` emits inline `<script>` patches for Suspense boundary flushes
- True DOM-claiming hydration via `HydrationCursor` — including streaming-mode Suspense: when `hydrate()` runs before a streamed boundary's swap script fires, `renderSuspense` detects the `<div id="__ssN">` placeholder, leaves the fallback DOM in place, captures the active context, and waits via `MutationObserver` for the swap; on swap it re-seeds the `DataRegistry` from the inline `__STEWIE_DATA__` patch and sub-cursor-hydrates the post-swap nodes, with no refetch and no fallback flash
- Client router with guards, data loading, lazy routes, View Transitions (with `stewie-kind-*` / `stewie-direction-*` / `stewie-transition-*` CSS types), scroll restoration (manual mode; forward/traverse/hash defaults; opt-out via `navigate({ scroll: false })`), `<Link>` hover/focus prefetch, Navigation API, History API fallback
- Layout routes via nested `<Route>` trees and `<Outlet />` — guards outermost→inner, parallel loaders, per-level `useRouteData()`, index routes via `path="."`, setup-time validation
- Typed route definitions via `createRoute(path, config)` — single declaration carries the path, runtime config (component / `beforeEnter` / `load`), and `P` / `Q` type shapes. The returned value is callable as a JSX component (`<ProjectEditRoute />` mounts the route inside `<Router>`) and is also passed value-typed to `useParams(route)` / `useQuery(route)`. `P` is inferred from the path literal via `PathParams<Path>`; explicit `<P, Q>` generics override when the path has no params or the route carries query types. The legacy generic forms — `useParams<T>()` over a hand-written `RouteDefinition` or a bare param shape — remain as overloads for back-compat. Mixing raw `<Route>` JSX and `createRoute` components in the same tree works (Router's child-walker recognises both shapes). See `decision-records/0003-route-definitions-via-createRoute.md`.
- SSR router with guard execution and `renderToString` integration
- Progressive asset streaming (Phases 1–3): per-boundary `<link rel="stylesheet">` and `<link rel="modulepreload">` emission via Vite's `ssr-manifest.json`; client-side gating in `lazy()` so a boundary's content does not flip until its CSS chunk loads; `<Link>` hover/focus prefetch via `router.preload()`, with `lazy().preload()` deduped through the shared `loadPromise` and `<Link prefetch={false}>` opt-out. SSR-emitted `data-stewie-id` dedup (the Loadable Components pattern) was descoped — the ssr-manifest covers the SSR side and `lazy()`'s `loadPromise` cache covers the client side
- Compiler: auto-wrap, `$prop` transform, source maps, module-scope validation
- Vite plugin with HMR
- Node, Bun, and Cloudflare Workers HTTP adapters (Cloudflare is a minimal Module Worker wrapper; `env` / `ctx` propagation to the app handler is deferred)
- Devtools panel: Renders, Stores, Routes, Graph tabs (with live signal dependency visualization)
- `@stewie-js/testing` mount and query utilities
- `create-stewie` CLI (static and SSR templates)
- Edge API guardrail (`scripts/check-edge-packages.mjs`)

## What Is Not Yet Real

- **Decision-oriented docs — publishing + completion** — draft content exists under `docs/` (guides: getting-started, reactivity, routing, ssr, components, **stewie-way**; `docs/patterns/`; `docs/reference/` API pages). What is missing: a published, discoverable docs *site* and completion of the "Stewie way" decision guides. The field evidence still stands — two canonical apps (Work Queue, external Pokemon demo) failed to discover shipped primitives (`useTitle`/`useMeta`/`<Head>`, `defineResource`/`useResource`, "component bodies are reactive scopes"). Draft markdown alone has not closed the discoverability gap; publishing + a "this is the Stewie way" guide is the highest-leverage remaining work. See the "Discoverability of existing primitives" decision below.
- **Diagnostics — partial** — `DIAGNOSTICS.md` blueprints ~52 `STW###` codes; ~20 are implemented in package source today (STW001-007, 010, 011, 014, 022, 030, 040, 042, 052, 073, 083, 092, 094, 095). The remaining ~30 (compiler rules + dev-runtime warnings, per-code silencing, docs links) are not yet built.
- **Deno adapter** — not yet written. (`@stewie-js/adapter-cloudflare` shipped 0.8.0 as a minimal Module Worker wrapper; `env` / `ctx` propagation to the app handler is deferred until a cross-adapter context-propagation design is settled.)
- **Edge-first test phases 2–4** — streaming confidence tests, router edge-flow tests, adapter conformance suite

---

## Design Influences

These are explicit inspirations from outside the web framework ecosystem that have shaped Stewie's design:

- **SwiftUI** — Two-way binding syntax (`$prop`) draws from SwiftUI's `$` prefix convention for bindings
- **Mobile native dialog patterns** — Snapshot isolation for dialogs (pass a `.peek()` snapshot, dialog works on a local copy, explicit commit boundary) comes from mobile native commit/dismiss patterns
- **Kotlin coroutine scope** — The `reactiveScope()` naming and mental model (a bounded scope that owns and disposes its children) is analogous to Kotlin's `CoroutineScope`

These are not aspirational comparisons — they are specific design decisions that were made with these influences in mind.

---

## Messaging Rules

- Lead with: **localized updates**, **bounded work**, **compiler cooperation** — what the user experiences
- Do not lead with: "signals" (commodity), anti-React framing, or "no re-renders ever" (imprecise)
- Performance claims require benchmark evidence. Do not assert performance without numbers.
- Comparisons (Solid, React, Svelte) are supporting context, not the identity of the project
- **Ordering (from the 2026-07-06 React/Solid comparison review):** lead with the two strongest moats — the **WinterCG/edge boundary** and the **first-party data story** — then the most novel API (`createRoute`). Do *not* headline with "small full framework": it's real but the hardest bet to *prove* (coherence is felt, not benchmarked) and it's the one Solid's ecosystem is closing on. Convergent primitives (`signal`/`effect`/`computed`/`store`, `<Show>`/`<For>`/`<Switch>`) are correct-but-not-a-moat; a different API *shape* (e.g. `signal()` as a callable object vs Solid's tuple) is a defensible choice, not a selling point on its own.

---

## How to Work on It

```bash
pnpm install               # install all workspace deps
pnpm test                  # run all tests (Vitest)
pnpm typecheck             # tsc --noEmit across all packages
pnpm build                 # build all packages (tsc --build)
pnpm check:edge            # verify no Node APIs in core/server
pnpm lint                  # oxlint
pnpm format                # oxfmt
```

Tests use `--reporter=agent` (not `--reporter=verbose`).

When bumping versions, update all `packages/*/package.json`, `examples/*/package.json`, and `packages/create-stewie/src/templates.ts`. Commit and tag before starting the next batch of changes.

`DIAGNOSTICS.md` at the repo root is the living inventory that drives roadmap item 18 (dev-mode / build-time diagnostics). When you add a primitive, change the semantics of an existing one, or remove something, update the relevant `STW###` entries in the same change — add new footguns, revise proposed messages, or drop entries that no longer apply. It is not user-facing docs; it is the implementation blueprint, and it only stays useful if it tracks the current API surface.

---

## Decisions Still Open

- ~~**Compiler type awareness (Bug 1)**~~ — Fixed. `analyzeFile` now accepts an optional `ts.TypeChecker`. When provided, `containsSignalRead` checks whether the callee of each no-arg call has a `Signal<T>`/`Computed<T>` type (callable + `.peek()`) before marking it as a wrap candidate. Falls back to the old syntax heuristic for plain JS or when the file isn't in the program. The Vite plugin creates a lazily-initialized `ts.Program` via `createProjectProgram(root)` and passes it through `CompileOptions.program`.
- ~~**`inject` → `consume` rename**~~ — Done. `consume(Context)` pairs with `provide(Context, value)`: ancestor provides, descendant consumes.
- **`use*` functions are not hooks** — `useParams()`, `useQuery()`, `useNavigationStatus()` etc. follow the `use*` naming convention for discoverability but are plain utility functions with no call-order rules. The word "hooks" must never appear in docs, comments, commit messages, or conversation when referring to Stewie's `use*` functions. Say "utility functions" or just "functions". Using "hooks" would mislead React developers into applying mental models and rules (call-order dependency, linter rules, no conditional calls) that do not exist in Stewie.
- ~~**Actions / mutations API shape**~~ — Settled. Ship `defineAction(fn)` + `useAction(def)`. `defineAction` returns an opaque `ActionDefinition<I, O>` that creates no signals (safe at module scope); `useAction` is a free function (matches `consume(Context)`, not `def.use()`) that creates the per-component `{ run, pending, error, lastRun, reset }` instance. `run` no-ops while pending and resolves with `undefined`; on error it sets `error` to the caught `Error` and resolves with `undefined`; on success it resolves with the action's return value. Each new `run` batches `pending=true, error=null` at start; on terminal it batches `pending=false, lastRun='success'|'error'`. `lastRun: Signal<'idle'|'success'|'error'|'blocked'>` exists so void-returning actions can branch unambiguously after `await act.run()` — the `result === undefined` idiom collides with success-void. `defineAction` has a zero-arg overload that infers `I=void`, and `Action<void, O>['run']` takes no parameter. `reset()` clears both `error` and `lastRun`, no-op while pending. No cancellation in v1. Post-mutation work (navigation, store sync, toasts) lives in caller code after `await submit.run()` — no lifecycle callbacks. See ROADMAP.md "Actions / Mutations" for the full settled spec.
- ~~**Form primitives — `createForm`**~~ — Settled: do not ship in v1. Validation = computeds, touched/dirty = signals, submit lifecycle = `useAction`, snapshot at the call site via `signal.peek()`. `createForm` would be a god-object that bundles things signals + computeds already compose cleanly. Tripwire: if 3+ canonical-app forms grow the same multi-field touched/dirty pattern, extract a small `field(signal, initial)` helper — not before. The `<form>` element is plain HTML; `<form onSubmit>` calls `useAction(...).run(snapshot)`; no form-shaped framework concept.
- ~~**Resource primitive shape**~~ — Settled and shipped in 0.8.0. `defineResource(fn)` + `useResource(def, source)` mirror `defineAction`/`useAction`: definition is opaque and safe at module scope, `useResource` creates the per-component instance. Reactive-triggering asymmetry stays (resources fire on source change; actions fire on `.run()`) — intrinsic to what each primitive is. The word "resource" is kept; revisit only if a clearly better word emerges.
- **Cross-cutting data concerns (middleware-style)** — Open. The Apollo Link pattern is real (auth header injection, retry, tracing, GraphQL→field-error mapping) and will eventually want some answer for Stewie. Rejected for v1: a generic middleware/link API would import the "layered bandaids" trap and clash with signals being the existing composition primitive. Plain function composition around `useAction` callbacks covers the named cases today. Revisit only when the canonical app shows the same wrapper recurring across resource + action sites — that's the evidence threshold for designing a primitive instead of guessing one.

  **Canonical-app observation (2026-05-28):** After landing the user concept in Work Queue (assignee, profile, project lead — 4 actions, 5 loaders touching the new model), no recurring wrapper pattern emerged. Each action resolves the viewer inside its body (`const viewer = getViewer(); if (!viewer) throw ...`) and each loader passes `getViewer()` straight through to `listUsers` / `getUser`. The repetition is real but mechanical, not cross-cutting. There is no retry, tracing, or error-mapping concern in the app yet. Threshold not met; do not extract.
- ~~**Data cache / query layer**~~ — Settled. Ship a minimal `DataRegistry` SPI (see "One registry primitive for SSR replay and client-side cache" above). The registry is store-backed, so cache invalidation and devtools come for free. Explicitly out of scope for v1: TTL/staleTime, manual invalidation API, refetch-on-focus, prefetch helpers, background revalidation. These layer on the same primitive when canonical-app pressure shows up — not before. Loaders and resources start with namespaced keys in the same registry; folding loaders into `defineResource` (so a loader fetching `/api/user/1` and a resource fetching the same dedupe automatically) is a follow-on refactor.
- ~~**Suspense + hydration correctness**~~ — Settled and shipped for both `renderToString` and `renderToStream`. SSR emits `<!--Suspense-->` after resolved children (`stream.ts`'s `awaitSuspense` branch), `renderSuspense` engages `HydrationCursor` via `collectUntilComment('Suspense')` (`dom-renderer.ts`), and `useResource` reads from the seeded `DataRegistry` before fetching (`resource.ts`, with `DataRegistryContext` provided by `hydrate()` from `window.__STEWIE_DATA__`). The streaming-mode placeholder-div path also handled: `renderSuspense` detects the `<div id="__ssN">` shape, defers via `MutationObserver`, re-seeds the registry from the inline patch on swap, then sub-cursor-hydrates the post-swap nodes — preserving context across the deferral via `captureContext`/`runWithContext`. Verified end-to-end by `hydration-integration.test.ts`'s "useResource data resolved on server is replayed without refetch on hydration" and "streaming-mode unresolved boundary" tests: zero refetches, no fallback flash, in either mode.
- **Auth / session patterns** — Start with canonical patterns in the Work Queue app (where session loading happens, how guards work on SSR vs client navigation, how protected layouts are structured). Extract a package only if a clear reusable primitive emerges from real usage. Auth varies too much across adapters and providers to be a useful first-party package at this stage.

  **Canonical-app pattern as of 2026-05-28** (Work Queue Steps 1–4):
  - Session lives in a module-level singleton (`src/data/mocks/auth.ts`) with `getSession`, `getViewer`, `signIn`, `signOut`. On the server it is shared across requests (demo-only — a real adapter would key off a cookie).
  - Three guard shapes proved useful and cover the cases seen so far:
    - `requireAuth(to, from)` — redirects to `/login?redirect=...` when no session.
    - A "redirect to viewer canonical URL" guard (`profileMeGuard`) — composes with auth by short-circuiting to `/login` when no viewer, otherwise redirects to a viewer-derived URL. No component ever renders.
    - A "self-only" guard (`requireSelfForProfileEdit`) that awaits `requireAuth` first, then extracts a URL param and compares to `viewer.id`, redirecting non-owners to the read-only sibling route.
  - **Defense in depth was free and load-bearing.** The `updateProfile` API rechecks `viewer.id === targetId` at the boundary; the route guard is UX, not security. This separation kept guard logic trivial (URL pattern match → compare ids → redirect) and let the API enforce the invariant without referencing routing.
  - **Discriminated `UserView` removed an entire class of UI bugs.** Sensitive fields (email, timezone, role, createdAt) are absent from the `public` arm of the union, so a typo or refactor cannot leak them — TypeScript rejects the access. The decision to enforce restrictions at the API boundary (not in the UI) paid off the moment a second consumer (`TaskRow` chip) arrived.

  No reusable primitive has surfaced yet. Guards are 3–10 lines each and all different — auth check, viewer-derived redirect, ownership check. The right next step is *not* a package; it is letting more patterns accumulate. Tripwire: when a third canonical-app guard repeats the same "auth + ownership + redirect to read-only sibling" shape, extract a helper at that point.
- ~~**Reactive props across component boundaries**~~ — Settled 2026-07-13. See `decision-records/0004-reactive-props-and-the-Reactive-type.md` for the full analysis (incl. the preserved (b)/(c) gotcha catalog, the publish-format question, and the 2026-05-28 canonical-app observations).

  **Decision:** keep accessor-typed props (option a) and make them ergonomic + honest rather than removing the `() => T` from signatures.
  - **Accessor-only, not the union.** Reactive prop → `name: () => string`; static prop → `name: string`. Avoid `T | (() => T)` (the arm-hazard that made `UserChip` need a `resolve()` helper). Accessor-only is unambiguous and the only option that is naturally **destructure-safe** — reactivity lives in *calling* the accessor, not accessing the property, so `const { name } = props; … name()` still tracks. That is the exact footgun proxy-props (b) can't escape.
  - **`type Reactive<T> = () => T`** ships from `@stewie-js/core` (type-only, no runtime surface). `Reactive<string>` reads as intent where bare `() => string` does not. Signals/computeds are callable, so they're already assignable to `Reactive<T>`; store fields connect via a thunk. It is a *plain structural alias* — it grants no extra type-system power (structurally identical to `() => T`) — but the compiler can key off its **alias symbol** for precise auto-wrap targeting.
  - **Compiler:** extend the type-aware auto-wrap to component props, keyed on the `Reactive` alias symbol (accessor shape as fallback). Asymmetric rule: the prop type triggers; the passed argument decides wrap-vs-pass-through (never double-wrap an existing accessor). **Compiler stays optional** — compiler-off you write the `() =>` yourself; verbose, never silently wrong. Bet #1 holds.
  - **Branding declined** (would force stamping signals/thunks and pull toward compiler-required). **Dead-thunk detection** (an accessor that reads no reactive sources) is out of the type story — it's a separate best-effort lint, `STW033`.

  **Why this isn't "settling for (a)":** component bodies run once at setup (no re-render loop), so accessor props are the *natural* subscription primitive and inline thunks aren't per-render churn. Accessor-typed props are an anti-pattern in React and idiomatic in Stewie for the same execution-model reason — `() => T` is Stewie's honest `Binding<T>`-style marker, made ergonomic by auto-wrap. Stage 2 ((b)/(c) contagion removal) is shelved and may never be needed.

  **Revisit only if** a concrete case shows the `Reactive<T>` signature is a real blocker (not merely visible), or Stewie decides to court library/component-kit authors — at which point the compiler-posture and publish-format calls must be made explicitly, using the preserved catalog in the ADR.

- ~~**Query-state ergonomics in the router (NEW 2026-05-28)**~~ — Addressed 2026-05-28. The Pokemon demo's biggest friction was that calling `useRouter().navigate()` (or any router-level query mutation) on every keystroke caused input focus loss and apparent route remounting. They abandoned reactive query state and fell back to `window.history.replaceState` plus a hand-rolled URL builder.

  **Root cause:** Two layered bugs in `packages/router/src/router.ts`. (1) `applyLocation` wrote all four location store fields (pathname / query / hash / params) on every navigation, including writes that didn't change the value. The store notifies on every assignment regardless of equality, so `matchedContent` — which reads `location.pathname` and `location.params` — re-ran on every nav, re-creating the route component via `jsx(rootLevel.component, ...)` and re-mounting its subtree. (2) `runGuardsAndLoad` reset *all* per-level data signals to `undefined` before re-running loaders, so even consumers reading `useRouteData()` reactively saw a transient `undefined`.

  **Fix:** `applyLocation` now compares each field to its current value before writing (`shallowEqualQuery` for the flat string maps). Query-only navigations no longer touch `pathname` or `params`, so `matchedContent` does not re-run, so the route does not re-mount.

  New SPI method `setQuery(patch, options?): void` shipped. Contract:
  - URL update + reactive `location.query` update are **synchronous**. `useQuery()` consumers see the new value immediately.
  - **Guards never run. Loaders never run.** `setQuery` is a URL+store annotation only. The route component never re-mounts.
  - Query-reactive *data* belongs at the fetch site, not the URL site: `useResource(fn, () => location.query.someKey)` declares the dependency where the fetch lives, deduplicates by registry key, and stays out of the routing lifecycle. Loaders are for cross-boundary navigation (where guards also need to run); using `setQuery` for a filter or live search does not cross that boundary.
  - `null` / `undefined` in the patch deletes the key.
  - Default history method is `replaceState`. Pass `{ push: true }` for an explicit history entry.
  - Bypasses the Navigation API path via a sentinel flag so the in-flight `history.*` call doesn't loop back through the navigate listener.

  **Why not a `{ loaders: true }` option:** the call site (`onInput`, a filter checkbox) does not and should not know which loaders care about which query keys. Putting that decision at the call site leaks loader internals upward and forces every consumer to re-derive it. Declaring the dependency inside the data layer (`useResource(fn, () => location.query.X)`) keeps the knowledge co-located with the fetch.

  See `router.test.ts` "query-only navigation does not re-mount the route" and the `setQuery` describe block for the locked-in behaviour.

  **Known footgun (STW075):** if a route `load(params, query)` reads its `query` argument and a caller uses `setQuery`, `useRouteData()` will hold stale data until the next real `navigate()`. Captured as a dev-mode warning in `DIAGNOSTICS.md` (Phase 3, dev-runtime, one-shot per route). User-code fix: move the query-dependent fetch into a `useResource` at the consumer.

  **What this does not address yet:** view-transition coherence around query updates (the next open decision below) and the broader question of when `navigate()` to a same-pathname URL should re-run loaders (current behaviour: always reruns; future option: opt-in flag if the loader does not depend on query).

- **Discoverability of existing primitives (NEW 2026-05-28)** — Open. Two canonical apps (Work Queue and the external Pokemon demo) have now been built. *Neither used `useTitle` / `useMeta` / `<Head>`* — both fell back to `effect(() => { document.title = ... })`. The Pokemon writeup explicitly says "there is no clear 'head management' abstraction in use" and requests "a simple title/meta API" — a feature we shipped but they could not find.

  Pokemon also: (i) wrote `let foo!: ReturnType<typeof signal<...>>; reactiveScope(() => { foo = signal(...) })` inside what were already component bodies, where a plain `const foo = signal(...)` would have worked (component bodies are reactive scopes), (ii) did not adopt `defineResource` / `useResource` despite the writeup noting they wanted "advice on when `resource()` should be preferred over route loaders", (iii) installed but did not meaningfully use `@stewie-js/devtools`.

  None of these are missing features. They are all *discoverability* failures. The next-step pressure here is for **decision-oriented docs** (already listed in "What Is Not Yet Real") — a "Stewie way" guide that says: this is how you set a page title; this is when you use a loader vs `useResource`; component bodies are reactive scopes — you only need `reactiveScope` for non-component code. Without this, every new user re-invents primitives we already ship.

  This makes the docs-gap entry in "Not yet real" the highest-leverage backlog item: it would have prevented Pokemon's head/title workaround, the `reactiveScope` misuse, and probably the `resource` non-adoption.

- ~~**View Transitions and scroll restoration coherence**~~ — Settled and shipped in 0.9.0. After a design pass and rubber-wall review the v1 contract is:

  **Two orthogonal fields on `NavigationStatus`:**
  - `kind: 'push' | 'replace' | 'traverse' | 'reload'` — *mechanical*, mirrors Navigation API `navigationType`. In the popstate fallback only `traverse` is observable.
  - `routeDirection: 'forward' | 'back' | 'default' | 'same'` — *structural*, computed by comparing the source chain to the destination chain (pattern prefix check). `same` means same chain with only params/query changed.

  **Direction is structural, not perceptual.** This is the load-bearing framing — fought for in rubber-wall review. `/products/12345 → /products/98765` is `same` even though the user perceives forward motion, because the route tree didn't move. Trying to infer perceptual direction from params would be the MobX-recipe trap. App authors who want a slide between products use `stewie-kind-push` CSS or animate at the component level.

  **`CreateRouteConfig.transition?: string`** — free-form transition group name, typically set on a layout route. Inherited by descendants via chain membership.

  **View Transition `types[]` emitted:**
  - Always: `stewie-kind-{kind}` and `stewie-direction-{routeDirection}`.
  - Conditionally: `stewie-transition-{group}` **only when** both source and destination chains include a level with that transition name AND direction is `forward` or `back`. Sibling-tab moves (direction `default`) and param-only moves (direction `same`) do not emit the group, so authors don't have to write CSS to suppress unwanted slides.

  **Scroll restoration:** `history.scrollRestoration = 'manual'`; router takes control. Forward (`push`/`replace`) → scroll to `(0, 0)`. Traverse → restore from history state (saved on each push). Hash nav (`/page#section`) → `element.scrollIntoView()`. Opt-out per call via `navigate({ to, scroll: false })`. All scroll work runs *inside* the VT update callback, same task, so the snapshot captures the post-scroll DOM.

  **Redirects:** original navigation's `kind` does not carry through naively — the guard redirect re-navigates with `replace: true`, so the redirected nav's `kind` becomes `'replace'` and `routeDirection` is recomputed against the final destination. Prevents `/private → /login` from accumulating in history.

  **Lazy + VT:** `router.preload()` is awaited on the matched chain's components before `startViewTransition` fires, so the new DOM is in place when the transition snapshots its end state. Otherwise the VT would snapshot an empty boundary and animate to nothing.

  **`view-transition-name` uniqueness is the author's responsibility.** The router does not auto-scope names. Documented in `docs/guide/routing.md` with the slide cookbook.

  **Explicitly out of scope for v1:** back/forward distinction within `traverse` (defer until needed; the Navigation API exposes it via index math but no canonical-app pressure yet); scroll-to-anchor after async data resolves; per-route scroll config; leaf-route transition override of layout transition (wait for the report).

  **Open tripwire:** if a third canonical-app instance hand-rolls per-component perceptual direction (the `/products/12345 → /products/98765` case), revisit whether to add an opt-in `navigate({ direction: 'forward' })` override.
