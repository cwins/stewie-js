# Stewie Docs

Stewie is a small, coherent TypeScript web framework for modern runtimes. You write plain, obvious components; fine-grained reactivity and the compiler turn them into **localized DOM updates** — when a signal changes, only the expression that read it updates, with no virtual DOM and no diffing.

What makes Stewie worth choosing over assembling your own stack:

- **Edge-first / WinterCG.** `@stewie-js/core` and `@stewie-js/server` use only standard Web APIs (`Request`, `Response`, `ReadableStream`) — no Node-specific APIs. Your app runs on Node, Bun, Cloudflare Workers, and Deno without a shim layer, and CI enforces that boundary.
- **A first-party data story.** Route loaders → SSR state transfer → true DOM-claiming hydration → clean client pickup is one coherent contract, not user-assembled glue. `defineResource`/`defineAction` and a shared data registry back it.
- **Typed routing built in.** `createRoute` collapses a route's path, config, and param/query types into one declaration — no second source of truth to keep in sync.
- **Explanatory devtools** that show *what* updated, *why*, and *what it subscribed to*.

Routing, SSR, testing, devtools, and the compiler are designed together as one framework rather than assembled from third-party pieces — so the pieces fit without compatibility hunting.

New here? Start with [Getting Started](guide/getting-started.md), then [The Stewie Way](guide/stewie-way.md) for which primitive to reach for when.

## Guide

- [Getting Started](guide/getting-started.md) — scaffold, manual setup, first component
- [Reactivity](guide/reactivity.md) — signals, computed, effects, store, the subscription model
- [Components](guide/components.md) — function components, JSX, control flow, context, lifecycle
- [Routing](guide/routing.md) — Router setup, navigation, guards, data loading, lazy routes
- [Server-Side Rendering](guide/ssr.md) — renderToString, streaming, hydration, ClientOnly, adapters
- [The Stewie Way](guide/stewie-way.md) — decision-oriented guide: which primitive for which job

## Patterns

Practical patterns and non-obvious behaviours worth knowing about.

- [Reactive Branches and Child Component Props](patterns/reactive-branches.md)
- [Derived Collections from Store State](patterns/derived-collections.md)
- [When to Use `reactiveScope`](patterns/reactive-scope.md)

## Reference

- [Core API](reference/core-api.md) — signals, computed, effects, store, context, control flow, async data (resources + actions), head / metadata, lazy, mount, hydrate
- [Router API](reference/router-api.md) — Router, Route, Link, hooks, guards
- [Server API](reference/server-api.md) — renderToString, renderToStream, hydration registry
