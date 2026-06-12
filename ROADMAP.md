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
| View Transitions + scroll restoration | `@stewie-js/router` | `document.startViewTransition({ update, types })` with `stewie-kind-*` / `stewie-direction-*` / `stewie-transition-*` types for CSS scoping; `routeDirection` computed from chain-prefix comparison (`forward`/`back`/`default`/`same`); `transition?: string` on layout routes for opt-in group animations; `scrollRestoration='manual'` with forward→(0,0) / traverse→restore / hash→scrollIntoView defaults and `navigate({ scroll: false })` opt-out |
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
| `defineResource` + `useResource` | `@stewie-js/core` | Signals (`data`, `loading`, `error`), `read()` for Suspense, `refetch()`. SSR replay via `DataRegistry` not yet wired — see "SSR + Hydration Correctness" below |
| `defineAction` + `useAction` | `@stewie-js/core` | `pending`, `error`, `lastRun`, `reset`; concurrent `run()` no-ops while pending |
| `useTitle`, `useMeta`, `<Head>` | `@stewie-js/core` | Signal-driven `document.head` mutations; `renderToString` returns `headHtml`; `renderToStream` emits per-boundary inline `<script>` head patches |
| Progressive asset streaming — Phase 1 | `@stewie-js/vite`, `@stewie-js/server` | Vite plugin rewrites `lazy(() => import('./X'))` to include the manifest id; `renderToStream` accepts a `manifest` option and emits deduped `<link rel="stylesheet">` per lazy boundary |
| Lazy hydration preserves SSR DOM | `@stewie-js/core` | `renderLazy` late-hydrates the still-in-DOM SSR nodes via a sub-cursor when the factory resolves — no flicker, no re-render |

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

Route loaders cover the read side. The write side — a blessed way to express mutations with pending/error state and safe reuse across components — is the gap this primitive fills. Without it every team builds their own ad hoc pattern.

**Status:** Shipped in 0.7.x.

**Spec — `defineAction` + `useAction`:**

```ts
// module scope — opaque definition, creates no signals
const saveTask = defineAction(async (input: { title: string }): Promise<{ id: string }> => {
  const res = await fetch('/api/tasks', { method: 'POST', body: JSON.stringify(input) });
  if (!res.ok) throw new Error('Could not save');
  return res.json();
});

// component body — creates per-component instance
function NewTaskForm() {
  const submit = useAction(saveTask);
  // submit.run, submit.pending, submit.error, submit.lastRun, submit.reset
}
```

`defineAction(fn)` returns an opaque `ActionDefinition<I, O>`. No signals are created at this step, so calling `defineAction` at module scope is safe and encouraged.

`useAction(def)` is a free function (matches `consume(Context)`, not `def.use()`) that creates the per-component instance. The instance owns its `pending` and `error` signals, scoped to the calling component. Two components calling `useAction(saveTask)` each get their own pending — sharing is by composition (lift into context, pass via prop), not by primitive design.

**Lifecycle per `run()`:**

| Phase | `pending` | `error` | `lastRun` |
|---|---|---|---|
| Before any call | `false` | `null` | `'idle'` |
| `run()` invoked (sync, in `batch`) | `true` | `null` | (unchanged) |
| Promise resolves successfully | `false` | `null` | `'success'` |
| Promise rejects | `false` | the caught `Error` | `'error'` |
| `run()` blocked while pending (returns immediately) | (unchanged) | (unchanged) | `'blocked'` |

Each new `run()` clears `error` at the start, so retries don't show stale failures. `run` returns `Promise<O | undefined>`: success → `O`; concurrent-blocked → `undefined`; caught error → `undefined`. For value-returning actions, `if (result === undefined) return;` is the canonical post-await branch. For void-returning actions, that idiom collides with success-void — use `if (act.lastRun() !== 'success') return;` instead.

**Zero-arg overload:** `defineAction(() => ...)` infers `I=void`, and `Action<void, O>['run']` takes no parameter. Call sites read `await logout.run()` rather than `await logout.run(undefined)`.

**Settled semantics:**

- `pending` is strictly bounded by the mutation itself; it does not extend through caller-side work like navigation, store updates, or toasts. Those are straight-line code after `await run()`.
- The framework does not interpret the result. Success vs. failure is observable via `error()` (`null` = success).
- Post-mutation work (navigation, store sync, optimistic rollback, toasts) lives in caller code after `await submit.run()`, not in lifecycle callbacks on the primitive. One path for success handling, not two.
- Concurrent `run()` calls on the same instance: the second no-ops while the first is pending. Returns `undefined`, doesn't touch `pending`/`error`, doesn't invoke the action body.
- `reset()` clears `error` to `null` and `lastRun` to `'idle'`. No-op while pending. Use case: dismissing a persistent error UI without retrying.
- No cancellation in v1. Adding `cancel()` later (with `AbortController` propagation) is non-breaking.

**Diagnostic:** `STW005 — useAction() called outside a component or reactiveScope()`. Same family as STW001-004; the rule is enforced statically by the compiler.

**Forms:** `useAction` is also the form-submission primitive. There is no `createForm()` in v1. See item 20 below.

**Snapshot pattern for async submit:**

Submit handlers should snapshot signals via `.peek()` at the call site to avoid the async-read hazard (signal mutated mid-submit by typing or external updates):

```ts
submit.run({ title: title.peek(), done: done.peek() });
```

A future diagnostic (best-effort, inline arrows only) may flag `signal()` reads inside an inline `defineAction` callback as a likely missing snapshot.

**Resource mirror:** The same definition/instance split applies to `resource()`, which will be reshaped to `defineResource(fn)` + `useResource(def, source)` in the same release. The triggering asymmetry (resources are reactive, actions are imperatively triggered) is intrinsic and stays.

**Future, not blocking — client-side action routes:** Actions referenced by stable path-shaped identifiers (e.g. `defineAction('/project/:id/edit', ...)`) with a runtime context registry doing the dispatch. Keeps shared actions discoverable without import-chain coupling, without requiring the compiler. Not a server/RPC concept — the URL is type-indexed identity, not a network endpoint. The current API leaves room for this layer to sit on top without redesign.

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

- **Form primitives** — settled as compose-don't-bundle: `useAction` + signals + computeds. No `createForm`. See "Actions / Mutations" for the settled spec and the multi-field-helper tripwire.
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

**Phase 1 — shipped.** `@stewie-js/vite` rewrites `lazy(() => import('./X'))` into `lazy(..., 'src/X.tsx')` — the source-id key Vite emits in `ssr-manifest.json`. `renderToStream` accepts the manifest via options and emits `<link rel="stylesheet">` per lazy boundary, deduped across the stream, before the boundary's HTML flush. No custom manifest, no developer ceremony — `lazy()` users get progressive CSS hints automatically when the manifest is wired through. Boundaries without an `id` (compiler-off `lazy()` calls) take the no-hint fallback path.

**Phase 2 — modulepreload + client hydration gating.** Emit `<link rel="modulepreload">` for the `.js`/`.mjs` assets in each boundary's manifest entry alongside the existing CSS links. Client hydration of a lazy boundary should gate on its CSS link `load` events before attaching reactive effects, to eliminate any FOUC during the hydration window.

**Phase 3 — shipped (0.9.0).** `<Link>` warms the next route's chunks on hover/focus via `router.preload(to)`, which calls the SPI's `preload()` on any `lazy()` component in the matched chain and runs guards/loaders for cache warming. `lazy()` returns a `LazyComponent<T>` whose `.preload()` is deduplicated through the shared `loadPromise`, so hovering the same link many times triggers exactly one factory call. Opt out per call with `<Link prefetch={false}>`. The router also awaits these chunks before `startViewTransition` fires, so the VT snapshot captures the loaded DOM instead of an empty boundary. SSR-emitted asset deduplication via `data-stewie-id` tagging (the Loadable Components pattern) was descoped — Vite's `ssr-manifest.json` is sufficient for the SSR side, and the client-side dedup happens inside `lazy()`'s `loadPromise` cache rather than via DOM scanning.

**Why this is architecturally different:** Because `lazy()` is a first-class framework primitive and `renderToStream` already has a per-boundary flush hook, the ssr-manifest is a natural bridge between Vite's build-time output and the render-time boundary ordering. Libraries participate by importing CSS normally — they do not wrap the renderer.

### SSR + Hydration Correctness for Suspense and Resources

Two coupled gaps that show up the moment an SSR app uses `Suspense` around a `useResource` consumer.

**Lazy hydration — fixed.** `renderLazy` previously claimed SSR nodes during hydration but only attached reactive effects when `loaded()` was already true on the first effect run — a near-impossible case, since the dynamic import is async. The factory then resolved, the SSR nodes were *removed* and re-rendered fresh: visible flicker, server work discarded. Now `renderLazy` tracks an explicit `needsHydration` flag and takes a hydration path (sub-cursor over the still-in-DOM SSR nodes) when `loaded` flips post-firstRun.

**Suspense hydration — open.** `renderSuspense` does not engage the `HydrationCursor` at all (`packages/core/src/dom-renderer.ts:707`). It creates a fresh `<!--Suspense-->` anchor and re-renders children client-side. If children throw a Promise on hydration (because `useResource` data wasn't replayed from SSR), the fallback flashes back in even though SSR already streamed the resolved content. The fix has three coordinated parts and they have to land together to be meaningful:

1. SSR emits `<!--Suspense-->` anchor at end of boundary content (both `renderToString` and `renderToStream`).
2. `renderSuspense` claims via `collectUntilComment('Suspense')` and runs children with a sub-cursor (mirrors `renderShow`).
3. `useResource` reads from a `DataRegistry` (see next item) so SSR-resolved data doesn't re-throw.

**`DataRegistry` SPI — open.** Single primitive shared by SSR replay and client-side cache. Settled interface: `has` / `get` / `set` / `serialize` / `serializeByKey` / `hydrate` / `hydrateByKey`. Backed by a reactive `store()` so cache invalidation and devtools fall out for free. Key derivation is `${defId}:${stableSerialize(args)}`. SSR emits `serializeByKey` payloads inline near each consuming component (not in a single end-of-stream blob) so a Suspense boundary's data lands with its content and progressive hydration is preserved. Hydration cursor consumes the inline payloads and calls `hydrateByKey`. `useResource` checks the registry first on every call.

Side benefits the registry gets us:

- Three components hitting the same endpoint with the same args: one fetch, all share the result.
- Back-navigation reusing recent results: works as long as the registry isn't cleared (lifetime: app instance).
- Future cache features (TTL/staleTime, manual invalidation, refetch on focus, prefetch, background revalidation) layer onto the same primitive without breaking the contract.

Out of scope for v1: any of those cache features. The minimum is the SPI plus inline replay, sized so the registry is comfortable to make a public export later.

Long-term: route loaders should be expressed *via* `defineResource` so a loader fetching `/api/user/1` and a `useResource(fetchUser, () => 1)` share identity through the same registry entry. Today they sit in namespaced regions of the same registry (`route:${path}:${paramsHash}` vs `${defId}:${argsHash}`); the unification is a follow-on refactor that doesn't change the SPI.

### Diagnostics — dev-mode and build-time

A coordinated set of checks that catch common mistakes with actionable messages. Compiler diagnostics flag issues statically during build/HMR; dev-runtime warnings catch what requires type info or execution context. Each diagnostic has a stable code (e.g. `STW001`), a one-line message, a docs link with the fix, and can be silenced individually.

**Discovery phase** — enumerate likely failure modes before implementing. Seeds:

- Signal referenced but not called in JSX (`label={name}` when `name: Signal<string>` — should be `{name()}`)
- Signal passed where a value is expected (function arg, object literal) outside a reactive context
- `signal()` / `computed()` / `store()` / `effect()` created at module scope
- `signal()` created inside an `effect()` body (leaks on every run)
- `onCleanup()` called outside a reactive scope
- `$prop` two-way binding targeting a non-signal
- `consume(Context)` with no ancestor `provide()` (runtime, dev-only)
- Route `load` / `beforeEnter` returning a signal instead of a value
- `resource()` fetcher that ignores its `AbortSignal`
- Hydration mismatch causes beyond text diff (attribute-level, structural)
- Reading a signal inside `untrack()` with no surrounding scope

**Deliverables:** compiler rule set, dev-runtime warning set, docs page mapping each code to a fix, per-code silencing mechanism.

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
18. **Diagnostics — dev-mode and build-time** — compiler + dev-runtime checks for common mistakes (signal not called in JSX, module-scope reactive primitives, `$prop` on non-signal, missing context provider, etc.); stable codes, docs page, per-code silencing
19. **Documentation site + decision-oriented guides** — API reference plus "the Stewie way" guides (signal vs store vs resource, route load vs resource, mutation patterns, etc.)
20. **Form primitives** — settled: no `createForm()` in v1. Forms compose from existing primitives (signals for fields/touched, computeds for validation/dirty, `useAction` for submit lifecycle, `signal.peek()` for the submit snapshot). Tripwire: extract a `field(signal, initial)` helper only after 3+ Work Queue forms grow the same multi-field touched/dirty pattern.
21. **Actions / mutations** — `defineAction` + `useAction` (settled spec above). Includes the parallel `defineResource` + `useResource` reshape of the existing flat `resource()`. New diagnostics STW005/STW006 for `useAction`/`useResource` outside component scope.
22. ~~**Head / metadata primitives**~~ — done; `useTitle`/`useMeta`/`<Head>` ship in core; `renderToString` returns `headHtml`; `renderToStream` emits inline `<script>` patches for Suspense boundary flushes
23. ~~**Progressive asset streaming — Phase 1**~~ — done; `@stewie-js/vite` injects manifest IDs into `lazy()` calls; `renderToStream` accepts a `manifest` and emits deduped per-boundary `<link rel="stylesheet">` before each lazy flush
24. ~~**Lazy hydration preserves SSR DOM**~~ — done; `renderLazy` now late-hydrates the still-in-DOM SSR nodes when the factory resolves instead of removing and re-rendering
25. **SSR + hydration correctness for Suspense and resources** — `DataRegistry` SPI (settled) + `useResource` integration + inline SSR payload emission + `renderSuspense` cursor claim. The three Suspense-fix sub-tasks and the registry land together; this is the next item
26. ~~**Progressive asset streaming — Phase 2**~~ — done in 0.8.x; `<link rel="modulepreload">` for JS chunks alongside the existing CSS links; client hydration gates on CSS load
27. ~~**Progressive asset streaming — Phase 3**~~ — done in 0.9.0; `<Link>` hover/focus prefetch via `router.preload()`, `lazy().preload()` deduplicated through `loadPromise`, `prefetch={false}` opt-out
28. ~~**View Transitions + scroll restoration coherence**~~ — done in 0.9.0; `NavigationStatus.kind` (Navigation API enum) + `routeDirection` (structural chain-prefix comparison); VT `types[]` carry `stewie-kind-*` / `stewie-direction-*` / `stewie-transition-*` for CSS scoping; `transition?: string` on layout routes for group animations; `scrollRestoration='manual'` with forward→(0,0) / traverse→restore / hash→scrollIntoView defaults and `navigate({ scroll: false })` opt-out
29. Edge-first testing phases 2–4
30. Cloudflare adapter
31. Typed route params and query
