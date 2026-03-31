// components.ts — built-in control flow components for @stewie-js/core
// These create element descriptors; actual rendering logic lives in dom-renderer.ts.

import type { Signal } from './reactive.js';
import { jsx } from './jsx-runtime.js';
import type { JSXElement, Component } from './jsx-runtime.js';

// ---------------------------------------------------------------------------
// Show — conditional rendering
// ---------------------------------------------------------------------------

export interface ShowProps<T> {
  when: T | (() => T) | Signal<T>;
  fallback?: JSXElement;
  children: JSXElement | JSXElement[] | (() => JSXElement | JSXElement[] | null);
}

export function Show<T>(props: ShowProps<T>): JSXElement {
  return jsx(Show as unknown as Component, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// For — keyed list rendering
// ---------------------------------------------------------------------------

export interface ForProps<T> {
  each: T[] | (() => T[]) | Signal<T[]>;
  key?: (item: T) => string | number;
  children: (item: T, index: number) => JSXElement;
}

export function For<T>(props: ForProps<T>): JSXElement {
  return jsx(For as unknown as Component, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Switch / Match — multi-branch conditional rendering
// ---------------------------------------------------------------------------

export interface SwitchProps {
  children: JSXElement | JSXElement[];
  fallback?: JSXElement;
}

export function Switch(props: SwitchProps): JSXElement {
  return jsx(Switch as unknown as Component, props as unknown as Record<string, unknown>);
}

export interface MatchProps<T> {
  when: T | (() => T);
  children: JSXElement | ((value: T) => JSXElement);
}

export function Match<T>(props: MatchProps<T>): JSXElement {
  return jsx(Match as unknown as Component, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Portal — render children into a different DOM target
// ---------------------------------------------------------------------------

export interface PortalProps {
  target?: Element | string;
  children: JSXElement | JSXElement[];
}

export function Portal(props: PortalProps): JSXElement {
  return jsx(Portal as unknown as Component, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// ErrorBoundary — catch rendering errors
// ---------------------------------------------------------------------------

export interface ErrorBoundaryProps {
  fallback: (err: unknown) => JSXElement;
  children: JSXElement | JSXElement[];
}

export function ErrorBoundary(props: ErrorBoundaryProps): JSXElement {
  return jsx(ErrorBoundary as unknown as Component, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Suspense — show fallback while children are loading
// ---------------------------------------------------------------------------

export interface SuspenseProps {
  fallback: JSXElement;
  children: JSXElement | JSXElement[];
}

export function Suspense(props: SuspenseProps): JSXElement {
  return jsx(Suspense as unknown as Component, props as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// ClientOnly — only render children on the client (not SSR)
// ---------------------------------------------------------------------------

export interface ClientOnlyProps {
  children: JSXElement | JSXElement[];
}

export function ClientOnly(props: ClientOnlyProps): JSXElement {
  return jsx(ClientOnly as unknown as Component, props as unknown as Record<string, unknown>);
}
