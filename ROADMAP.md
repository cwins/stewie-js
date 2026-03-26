# Stewie Roadmap

This document tracks open items from the original build plan and potential enhancements for future development.

---

## Open Items

These were part of the original design but are not yet implemented or are only partially complete.

### Core

- **`<Switch>` / `<Match>` control flow** — first-matching-branch conditional rendering. Planned in Phase 3 but not implemented. Would complement `<Show>` for multi-branch logic.
- **`<Portal>` component** — render children into an arbitrary DOM node outside the component tree. Essential for modals, tooltips, and dropdowns.
- **`<Suspense>` boundary** — async loading boundary that shows a fallback while async children resolve. Required for the data-loading and lazy-route stories to work end-to-end.
- **`<ClientOnly>` component** — renders nothing on the server, children on the client after hydration. Needed for third-party widgets that assume a DOM.
- **`batch()` public API** — the internal batching mechanism exists but isn't exported. Useful when users need to make multiple signal writes without triggering intermediate effects.

### Compiler

- **Fine-grained reactive output** — the compiler currently handles JSX transformation and validation. The deeper optimization — static vs. reactive attribute analysis and emitting direct DOM subscriptions instead of full reconciliation — is the highest-leverage remaining work.
- **`$prop` two-way binding transform** — the spec is defined (expand `$value={sig}` → `value={sig()} onInput={e => sig.set(e.target.value)}`), including collision detection and readonly/disabled downgrade warnings, but the transform isn't wired up in the emitter yet.
- **Source maps** — dev-mode inline source maps and production external `.map` files for compiled TSX output.

### SSR

- **`renderToStream`** — streaming SSR using the WinterCG `ReadableStream` API. Ships the HTML shell immediately and flushes `<Suspense>` boundaries progressively. The architecture for this was designed (nonce support, inline `<script>` chunks per boundary) but not implemented.
- **Server Components** — components in `.server.tsx` files (or decorated with a `server: true` marker) that run only during SSR and emit zero client JS. Requires compiler + bundler cooperation.
- **Hydration mismatch detection** — in dev mode, compare the server-rendered DOM to the client render and log clear diffs. Particularly useful for catching date/time or locale inconsistencies.

### Router

- **Route guards** — async `beforeEnter(to, from)` hook that can redirect or block navigation. Essential for auth flows.
- **Route-level data loading** — a `load` function on route definitions that runs before the component renders and integrates with `<Suspense>`. Eliminates loading spinners inside components.
- **Lazy routes** — `component: lazy(() => import('./Page'))` with automatic code splitting at the route boundary. Currently all routes are eagerly bundled.
- **View Transitions API** — wrap `router.navigate()` in `document.startViewTransition?.()` for native page transition animations where supported.
- **Typed params and query** — `useParams<{ id: string }>()` and `useQuery<{ tab: string }>()` with inferred types derived from the route definition, ideally without manual type annotation.

### Adapters

- **`@stewie-js/adapter-cloudflare`** — Cloudflare Workers / Pages adapter. Workers speak `Request`/`Response` natively so this should be thin, but the `ReadableStream` streaming path needs validation in that environment.
- **`@stewie-js/adapter-deno`** — Deno.serve adapter. Similar scope to the Bun adapter.

---

## Potential Enhancements

Things not in the original plan that would meaningfully improve the developer experience or expand what Stewie can do.

### DevTools

- **Component tree tab** — visualize the live component hierarchy with signal subscription counts per node. Would require the runtime to register component boundaries.
- **Signal graph visualization** — a dependency graph showing which signals feed which computed values and effects. Invaluable for understanding reactivity chains in larger apps.
- **Time-travel debugging** — snapshot signal/store state at each write, allow stepping backwards. Ambitious but a genuine differentiator.
- **DevTools as a browser extension** — move the panel out of the injected overlay and into a proper Chrome/Firefox DevTools extension panel. Removes the z-index and layout interference issues.

### Developer Experience

- **VS Code extension** — syntax highlighting for Stewie-specific JSX patterns (`$prop` bindings), autocomplete for `signal`/`computed`/`store` patterns, inline diagnostics forwarded from the compiler.
- **ESLint plugin** — rules for common mistakes: signals read outside reactive scope, missing `createRoot` wrappers, `store()` at module scope.
- **`stewie upgrade` CLI command** — automates `@stewie-js/*` version bumps across a project's `package.json`, similar to `ng update`.
- **More `create-stewie` templates** — a full-stack template with API routes alongside the UI, a minimal "hello world" with no router, and an SSR+auth example demonstrating route guards.

### Runtime

- **Animation primitives** — `useTransition()` and `useSpring()` reactive utilities that integrate cleanly with signals. Rather than a full animation library, thin wrappers over the Web Animations API driven by reactive values.
- **Form primitives** — `createForm({ fields, validate })` that returns per-field signals, dirty/touched state, and a submit handler. Eliminates the boilerplate seen in `TaskEditSheet` and `CreateTaskView`.
- **`resource()` primitive** — a higher-level async primitive that wraps `fetch` or any async function, returning `{ data, loading, error }` signals and integrating with `<Suspense>`. The natural companion to route-level data loading.
- **Island architecture / partial hydration** — allow SSR pages to ship zero JS by default and opt specific components ("islands") into hydration. Would require compiler support to identify island boundaries.

### Infrastructure

- **`@stewie-js/webpack`** — Webpack 5 plugin wrapping the compiler. Broadens Stewie's reach to projects not yet on Vite.
- **Performance benchmark suite** — automated benchmarks against React, Vue, Solid, and Svelte on the [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) scenarios. Gives a factual basis for the "no VDOM" performance claims.
- **Documentation site** — dedicated docs with the API reference, guides (SSR setup, routing, reactivity deep-dive), and interactive examples. `create-stewie` is a good start but prose docs are needed for anything beyond "getting started."

---

## Priority Suggestion

If forced to order the open items by impact:

1. `$prop` compiler transform — it's already specced, just needs wiring
2. `<Suspense>` + `resource()` — unlocks async data patterns
3. Route guards + lazy routes — required for real production apps
4. `renderToStream` — streaming is a meaningful UX and SEO win
5. Fine-grained compiler output — the core performance differentiator
6. `<Portal>` — small lift, high practical value
7. Form primitives — reduces the most common boilerplate
