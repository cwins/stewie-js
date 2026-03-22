// @stewie/core/dom/jsx-runtime
//
// DOM JSX runtime — activated when TypeScript sees the pragma:
//   /** @jsxImportSource @stewie/core/dom */
//
// Instead of producing JSXElement descriptors (like the standard runtime),
// this runtime creates real DOM elements with fine-grained reactive
// subscriptions wired up at creation time.
//
// Usage with the Stewie Vite plugin (added automatically):
//   The plugin prepends the @jsxImportSource pragma to every client-side .tsx
//   file, causing TypeScript / esbuild to call these functions for all JSX.
//
// Usage with mount():
//   mount(() => <App />, document.getElementById('root')!)
//   ↑ The function form of mount() activates the render scope that collects
//     all effect disposers created during JSX evaluation.

import { Fragment as _Fragment } from '../jsx-runtime.js'
import { _createNode, mount as _mount } from '../dom-renderer.js'
import type { JSXElement } from '../jsx-runtime.js'

export { _Fragment as Fragment }

// Re-export JSX namespace so TS type-checking works with this runtime
export type { JSX } from '../jsx-runtime.js'

/**
 * Create a real DOM element. Called by TypeScript's JSX transform for every
 * JSX expression when @jsxImportSource is @stewie/core/dom.
 *
 * - Static props (strings, numbers, booleans) → set once
 * - Function props (signals, computed) → wrapped in effect(), updated reactively
 * - Event handlers (onClick, onInput, …) → addEventListener
 * - Children are real DOM nodes created by recursive jsx() calls
 */
export function jsx(type: JSXElement['type'], props: Record<string, unknown>, _key?: string): Node {
  return _createNode(type, props)
}

/**
 * jsxs is identical to jsx. TypeScript calls jsxs for elements with a
 * statically-known array of children (no key spread needed), but our
 * runtime treats them the same.
 */
export const jsxs = jsx

/**
 * mount() for DOM runtime mode. Accepts a function that returns DOM nodes
 * created by the DOM JSX runtime, sets up the render scope, and returns a
 * disposer that stops all reactive effects and clears the container.
 *
 * Re-exported from dom-renderer for convenience so callers can import from
 * a single location:
 *   import { mount } from '@stewie/core/dom'
 */
export { _mount as mount }
