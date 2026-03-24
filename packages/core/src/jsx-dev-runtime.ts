// jsx-dev-runtime.ts — dev-mode JSX runtime for @stewie/core
//
// Vite uses jsx-dev-runtime in development mode, which calls `jsxDEV` instead
// of `jsx`. The dev runtime receives extra source location info for debugging.
// We simply forward to the same runtime as production — no extra overhead.

export { jsx as jsxDEV, jsxs, Fragment } from './jsx-runtime.js'
export type { JSX } from './jsx-runtime.js'
