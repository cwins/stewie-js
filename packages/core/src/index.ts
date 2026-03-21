// @stewie/core — reactivity primitives, JSX runtime, context

export const version = '0.0.1'

export type { Signal, Computed, Dispose, Scope, Subscribable, Subscriber } from './reactive.js'
export {
  signal,
  computed,
  effect,
  batch,
  untrack,
  createRoot,
  getCurrentScope,
  createScope,
  _allowReactiveCreation,
  _setAllowReactiveCreation,
} from './reactive.js'

export { store } from './store.js'

// Context system
export type { Context } from './context.js'
export { createContext, provide, inject } from './context.js'

// JSX runtime
export type { JSXElement, Component, CSSProperties, HTMLAttributes, ButtonAttributes, InputAttributes, AnchorAttributes, ImgAttributes } from './jsx-runtime.js'
export { jsx, jsxs, Fragment } from './jsx-runtime.js'
export type { JSX } from './jsx-runtime.js'

// Built-in control flow components
export type { ShowProps, ForProps, SwitchProps, MatchProps, PortalProps, ErrorBoundaryProps, SuspenseProps, ClientOnlyProps } from './components.js'
export { Show, For, Switch, Match, Portal, ErrorBoundary, Suspense, ClientOnly } from './components.js'
