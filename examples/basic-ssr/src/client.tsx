// client.tsx — browser entry point for the basic-ssr example
//
// This file is the client bundle entry. @stewie/vite configures the correct
// JSX runtime automatically (DOM runtime for client, descriptor for SSR).
//
// hydrate() does three things:
//   1. Reads window.__STEWIE_STATE__ injected by renderToString().
//   2. Creates a client HydrationRegistry from that state and provides it
//      via HydrationRegistryContext — the same context token that App reads.
//   3. Calls mount() to render the component tree into the container,
//      wiring up all reactive subscriptions.
//
// Because the App component reads its initial state from the registry,
// the client starts with exactly the data the server rendered — no
// additional API request needed.

import { hydrate } from '@stewie/core'
import { App } from './app.js'

const container = document.getElementById('app') ?? document.body
hydrate(<App />, container)
