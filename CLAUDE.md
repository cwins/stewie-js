# Stewie — Project Context for Claude

This file is the canonical reference for the Stewie framework. Read it at the start of every session. It supersedes any stale memory files or plan documents.

---

## What Stewie Is

A small, coherent TypeScript web framework for modern runtimes. It covers reactivity, rendering, SSR, routing, a compiler, testing utilities, devtools, and scaffolding — all designed together as a whole rather than assembled from third-party pieces.

**Current version:** 0.6.0
**Package scope:** `@stewie-js/*`
**Monorepo manager:** pnpm workspaces

---

## What Stewie Is NOT

- Not a React replacement or anti-React project. Framing it that way is lazy and misleading.
- Not trying to be "the next Solid". Solid is an inspiration, not a target.
- Not commodity signals with a branding coat. The differentiation is coherence + target environment, not primitive novelty.
- Not Node-specific. WinterCG compatibility is a genuine design constraint, not a marketing claim.

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

### Compiler is optional
**Decision:** The Vite compiler plugin (`@stewie-js/vite`) improves output but is not required. Plain JSX via `jsxImportSource` produces a fully working app.
**Why:** Not every project uses Vite. The runtime must work correctly without compiler transforms. Compiler improvements that only apply when the compiler is present are fine, but improvements that benefit both paths are always preferred.

### Signal child folding (dom-renderer)
**Decision:** When a function child returns a function (i.e., the compiler emits `() => item().label` where `label` is a `Signal<string>`), the dom-renderer calls through one level within the same effect rather than recursing into a nested `renderChildren` call.
**Why:** Prevents double-nesting: without folding, each such child creates two comment anchors and two effects. With folding, it creates one. This halved the anchor count in compiler output from 3 per row to 2 per row in the benchmark.

### WinterCG boundary is hard
**Decision:** `packages/core` and `packages/server` must never import Node.js APIs.
**Why:** These packages run in edge environments. A single `import { readFileSync } from 'fs'` breaks Cloudflare Workers. `scripts/check-edge-packages.mjs` enforces this in CI via static analysis.

### Hydration claims existing DOM
**Decision:** `hydrate()` walks the server-rendered DOM via `HydrationCursor`, attaches reactive effects to existing nodes, and does not wipe and re-render.
**Why:** True hydration: ~0 DOM mutations on load, no layout thrash, faster TTI. Wipe-and-rerender throws away the server's work.

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
- `resource()` with `AbortController` cancellation
- `Show`, `For` (keyed, LIS-based), `Switch`/`Match`, `Portal`, `ErrorBoundary`, `Suspense`, `ClientOnly`, `lazy()`
- Context (`createContext`, `inject`, `provide`)
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

- **Form primitives** — no `createForm()`, no per-field signal abstraction
- **Documentation site** — no public docs
- **Typed route params/query** — `useParams` and `useQuery` return `Record<string, string>`, not inferred from route definition
- **Cloudflare and Deno adapters** — not yet written
- **Edge-first test phases 2–4** — streaming confidence tests, router edge-flow tests, adapter conformance suite

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

---

## Decisions Still Open

- **Compiler type awareness (Bug 1)** — the compiler's `containsNoArgIdentifierCall` heuristic is too broad: it wraps `{row().id}` as reactive even though `.id` returns a plain `number`. The correct fix requires a TypeScript type checker (`ts.createProgram`) in the compiler pipeline to distinguish `Signal<T>` return types. Currently deferred.
- **`inject` → `consume` rename** — `inject(Context)` is a context lookup, not injection. Planned rename to `consume(Context)` to pair honestly with `provide(Context, value)`. Not yet done.
- **`use*` router utility functions are not hooks** — `useParams()`, `useQuery()` etc. follow the `use*` naming convention but are plain utility functions with no call-order rules. Docs must never call them "hooks".
