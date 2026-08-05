---
layout: home

hero:
  name: Stewie
  text: A coherent TypeScript framework for the edge
  tagline: Fine-grained reactivity, SSR, routing, and a compiler — designed together, running on any WinterCG runtime.
  image:
    src: /stewie-logo.png
    alt: Stewie
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: The Stewie Way
      link: /guide/stewie-way
    - theme: alt
      text: API Reference
      link: /reference/core-api

features:
  - title: Edge-first / WinterCG
    details: core and server use only standard Web APIs — Request, Response, ReadableStream. Runs on Node, Bun, Cloudflare Workers, and Deno without a shim layer, and CI enforces the boundary.
    link: /guide/ssr
  - title: A first-party data story
    details: Route loaders → SSR state transfer → true DOM-claiming hydration → clean client pickup is one coherent contract, backed by defineResource / defineAction and a shared data registry.
    link: /guide/ssr
  - title: Localized updates
    details: You write plain components; fine-grained reactivity updates only the expression that read a signal. No virtual DOM, no diffing.
    link: /guide/reactivity
  - title: Typed routing built in
    details: createRoute collapses a route's path, config, and param/query types into one declaration — no second source of truth to keep in sync.
    link: /guide/routing
  - title: Explanatory devtools
    details: Tooling that shows what updated, why it updated, and what it subscribed to — reinforcing the mental model, not just exposing internals.
  - title: One designed whole
    details: Routing, SSR, testing, devtools, and the compiler are designed together rather than assembled from third-party pieces, so they fit without compatibility hunting.
---
