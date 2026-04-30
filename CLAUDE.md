# Stewie — Project Context for Claude

This file is the canonical reference for the Stewie framework. Read it at the start of every session. It supersedes any stale memory files or plan documents.

---

## What Stewie Is

A small, coherent TypeScript web framework for modern runtimes. It covers reactivity, rendering, SSR, routing, a compiler, testing utilities, devtools, and scaffolding — all designed together as a whole rather than assembled from third-party pieces.

**Current version:** 0.7.1
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
- True DOM-claiming hydration via `HydrationCursor`
- Client router with guards, data loading, lazy routes, View Transitions, Navigation API, History API fallback
- SSR router with guard execution and `renderToString` integration
- Compiler: auto-wrap, `$prop` transform, source maps, module-scope validation
- Vite plugin with HMR
- Node and Bun HTTP adapters
- Devtools panel: Renders, Stores, Routes, Graph tabs (with live signal dependency visualization)
- `@stewie-js/testing` mount and query utilities
- `create-stewie` CLI (static and SSR templates)
- Edge API guardrail (`scripts/check-edge-packages.mjs`)

## What Is Not Yet Real

- **Head / metadata primitives** — no `useTitle`, `useMeta`, or `<Head>`; managing `document.title` and meta tags requires raw DOM manipulation today
- **Progressive asset streaming** — `renderToStream` does not yet emit per-boundary CSS `<link>` tags; no Vite plugin component-to-assets manifest; no hydration gating on CSS load
- **Decision-oriented docs** — no "Stewie way" guides; no public docs at all
- **Typed route params/query** — `useParams` and `useQuery` return `Record<string, string>`, not inferred from route definition
- **Cloudflare and Deno adapters** — not yet written
- **Layout routes** — no nested route layouts; the `<Router>` renders only the matched route component, so persistent chrome (nav bars, sidebars) must be repeated inside each page via a wrapper like `<AppShell>`
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
- **Data cache / query layer** — `defineResource`/`useResource` plus route loaders covers the common case well. Do not rush toward a TanStack-Query-style cache. Revisit only if the canonical app hits concrete ceilings that `resource` + loaders cannot address. A full cache layer risks making the API surface sprawling.
- **Auth / session patterns** — Start with canonical patterns in the Work Queue app (where session loading happens, how guards work on SSR vs client navigation, how protected layouts are structured). Extract a package only if a clear reusable primitive emerges from real usage. Auth varies too much across adapters and providers to be a useful first-party package at this stage.
- **Reactive props across component boundaries** — Open. Today, passing live data into a child component requires accessor-typed props: parent writes `<Child name={() => episode().name} />` and child types `name: () => string` and reads `props.name()`. This contradicts the stated principle that the developer should not have to write code differently for reactivity to work — every component author has to think about which props might be reactive and pollute their type signatures with `() => T`. Three known design points: (a) **accessor-typed props** (current state — honest, verbose, contagious); (b) **proxy props** à la Solid, where `props` is a Proxy that intercepts property access and tracks the read, so `props.name` stays live but destructuring silently breaks reactivity (papercut moves rather than disappears, and helpers like `mergeProps`/`splitProps` exist specifically to work around it); (c) **compiler-rewritten access**, where the author writes `props.name` and the compiler — guided by the prop's declared type — emits the appropriate read (`.()` for accessor types, tracked property access for proxy types, or autowraps the surrounding JSX slot). SwiftUI's `@Observable` / `@State` / `@Binding` is a strong inspiration: Swift macros + property wrappers make the observation transparent at the call site (`view.title` Just Works, the macro instruments it), and the same model maps onto JSX prop reads if Stewie commits to compiler-driven observability. Cost of (c) is heavier compiler dependence — plain-JSX users (no Vite plugin) would see worse ergonomics, weakening the "compiler is optional" decision. Need to decide whether Stewie is willing to make the compiler load-bearing for the most common case (component composition), and if not, what the plain-JSX story should look like. Do not pick until the canonical app has enough cross-component data flow to feel each option's cost concretely.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **stewie-js** (2994 symbols, 5117 relationships, 248 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **Run `gitnexus_impact` based on judgment** before edits that look non-trivial: modifying a widely-used symbol, changing a signature, touching something with many upstream callers, or any change where you're unsure of the blast radius. Skip it for obvious low-risk edits (comments, docstrings, isolated test files, a brand-new file with no callers yet). When you do run it, report the blast radius to the user.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/stewie-js/context` | Codebase overview, check index freshness |
| `gitnexus://repo/stewie-js/clusters` | All functional areas |
| `gitnexus://repo/stewie-js/processes` | All execution flows |
| `gitnexus://repo/stewie-js/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
