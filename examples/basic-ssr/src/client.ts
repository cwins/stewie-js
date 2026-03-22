// client.ts — browser entry point for the basic-ssr example
//
// This file is the client bundle entry. In a production app it would be
// processed by @stewie/vite, which:
//   1. Injects the @jsxImportSource pragma so all JSX uses the DOM runtime.
//   2. Enables HMR with reactive state preservation.
//   3. Tree-shakes server-only code (renderToString, etc.).
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

import { hydrate, jsx } from '@stewie/core'
import { App } from './app.js'
import type { Component } from '@stewie/core'

const container = document.getElementById('app') ?? document.body
hydrate(jsx(App as unknown as Component, {}), container)
