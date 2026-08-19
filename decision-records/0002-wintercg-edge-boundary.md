# 0002 — `core` and `server` packages forbid Node.js APIs

Date: 2026-04-28

## Status

Accepted

## Context

Stewie targets multiple JavaScript runtimes (Node, Bun, Cloudflare
Workers, Deno). Edge runtimes implement the WinterCG-defined Web API
surface (`Request`, `Response`, `ReadableStream`, `crypto.subtle`,
etc.) but do not expose Node's built-in modules (`fs`, `path`,
`stream`, `http`, `process`, `Buffer`).

A single `import { readFileSync } from 'fs'` inside `@stewie-js/core`
or `@stewie-js/server` would break Cloudflare Workers at deploy time,
not at install time. By then the breakage is far from the change that
caused it, and the bundler error message is rarely actionable.

We considered:

1. A polyfill / shim layer that mocks Node APIs in edge environments.
2. Splitting each package into `core-node` and `core-edge`.
3. A hard rule that `core` and `server` may only import standard Web
   APIs, enforced in CI by static analysis.

Option 1 hides the cost of the offending API behind a slow / partial
shim and encourages drift. Option 2 doubles the package surface and
forces every adapter to pick a side.

## Decision

Adopt option 3. `@stewie-js/core` and `@stewie-js/server` may only use
APIs that are part of the WinterCG Minimum Common Web Platform.
Anything Node-specific lives in `@stewie-js/adapter-node` (and bun-,
cloudflare-, deno-specific code in their respective adapters).

Enforced by `scripts/check-edge-packages.mjs`, which static-analyzes
imports and fails CI on any reference to a Node built-in or
`node:`-prefixed module. Runs as `pnpm check:edge`.

## Consequences

- The "does this run on Cloudflare Workers" question is answered at PR
  time, not at deploy time. Cost of regressions is paid by the change
  that introduced them.
- Adapters become the only place where runtime-specific code lives.
  The boundary is sharp and easy to reason about.
- Some otherwise-natural conveniences are off-limits in `core` /
  `server`. Reading a file from disk during SSR setup, for example,
  has to happen in the adapter and be passed in. This is friction by
  design — it forces the runtime-specific concern to surface where it
  can be replaced per adapter.
- The static analyzer is a load-bearing CI step; if it stops running,
  the boundary erodes silently. Keeping `check:edge` in the same CI
  job as `test` (so a green build implies both) is part of this
  decision.
- Closing the door on Node APIs in these packages closes the door on
  any third-party dependency that imports them transitively. Adding a
  dep to `core` or `server` requires checking its import graph first.
