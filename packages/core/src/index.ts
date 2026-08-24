// @stewie-js/core — reactivity primitives, JSX runtime, context

export const version = '0.10.2';

export type { Signal, Computed, Reactive, Dispose, Scope, Subscribable, Subscriber, Owner } from './reactive.js';
export {
  signal,
  computed,
  effect,
  batch,
  untrack,
  onCleanup,
  getOwner,
  runInOwner,
  reactiveScope,
  withRenderIsolation,
  getCurrentScope,
  createScope
} from './reactive.js';
export { isDev, __devHooks, _setNextEffectMeta } from './reactive.js';
export type { DevEffectMeta } from './reactive.js';

export { store } from './store.js';

// Context system
export type { Context, ContextProvider, ContextSnapshot } from './context.js';
export { createContext, provide, consume, captureContext, runWithContext } from './context.js';

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

// DataRegistry — keyed cache + SSR replay primitive backing useResource and
// (eventually) route loaders. Server emits per-key payloads inline alongside
// each Suspense flush; client seeds the registry before the consumer's
// first read. Resource fetches consult the registry first, write on success.
export type { DataRegistry } from './data-registry.js';
export { createDataRegistry, DataRegistryContext, useDataRegistry, dataRegistryKey } from './data-registry.js';
export { hydrate } from './hydrate.js';

// Lazy-loaded components
export { lazy, _LazyBoundary } from './lazy.js';
export type { _LazyBoundaryProps, LazyComponent } from './lazy.js';

// Async resource primitive — defineResource + useResource.
// defineResource(fn) creates no signals (safe at module scope).
// useResource(def, source) creates the per-component reactive instance.
export type { Resource, ResourceDefinition } from './resource.js';
export { defineResource, useResource } from './resource.js';

// Diagnostics (shared shape for compiler + dev-runtime)
export type { Diagnostic, DiagnosticSeverity } from './diagnostics.js';
export { diagnosticDocsUrl } from './diagnostics.js';

// Actions — write-side mutation primitive (defineAction + useAction).
// See ROADMAP.md "Actions / Mutations" for the settled spec.
export type { Action, ActionDefinition } from './action.js';
export { defineAction, useAction } from './action.js';

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

// Head / metadata primitives — useTitle, useMeta, <Head>
// Server-side: HeadContext + createHeadCollector are used by @stewie-js/server
// to collect and emit head entries during SSR.
export type { HeadEntry, HeadCollector, HeadProps, UseMetaProps } from './head.js';
export { useTitle, useMeta, Head, HeadContext, createHeadCollector } from './head.js';
