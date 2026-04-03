// @stewie-js/core — reactivity primitives, JSX runtime, context

export const version = '0.5.0';

export type { Signal, Computed, Dispose, Scope, Subscribable, Subscriber } from './reactive.js';
export {
  signal,
  computed,
  effect,
  batch,
  untrack,
  createRoot,
  withRenderIsolation,
  getCurrentScope,
  createScope
} from './reactive.js';
export { isDev, __devHooks, _setNextEffectMeta } from './reactive.js';
export type { DevEffectMeta } from './reactive.js';

export { store } from './store.js';

// Context system
export type { Context, ContextProvider, ContextSnapshot } from './context.js';
export { createContext, provide, inject, captureContext, runWithContext } from './context.js';

// JSX runtime
export type {
  JSXElement,
  Component,
  CSSProperties,
  HTMLAttributes,
  ButtonAttributes,
  InputAttributes,
  AnchorAttributes,
  ImgAttributes
} from './jsx-runtime.js';
export { jsx, jsxs, Fragment } from './jsx-runtime.js';
export type { JSX } from './jsx-runtime.js';

// Client-side DOM renderer + hydration
export type { Disposer } from './dom-renderer.js';
export { mount } from './dom-renderer.js';
export type { HydrationRegistry } from './hydration.js';
export { HydrationRegistryContext, useHydrationRegistry } from './hydration.js';
export { hydrate } from './hydrate.js';

// Lazy-loaded components
export { lazy, _LazyBoundary } from './lazy.js';
export type { _LazyBoundaryProps } from './lazy.js';

// Async resource primitive
export type { Resource } from './resource.js';
export { resource } from './resource.js';

// Built-in control flow components
export type {
  ShowProps,
  ForProps,
  SwitchProps,
  MatchProps,
  PortalProps,
  ErrorBoundaryProps,
  SuspenseProps,
  ClientOnlyProps
} from './components.js';
export { Show, For, Switch, Match, Portal, ErrorBoundary, Suspense, ClientOnly } from './components.js';
