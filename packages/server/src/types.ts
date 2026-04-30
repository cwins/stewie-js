import type { JSXElement } from '@stewie-js/core';

export type Component = () => JSXElement | null | string;

/**
 * Vite SSR manifest shape: keys are root-relative source module IDs
 * (e.g. `src/pages/foo.tsx`), values are arrays of client asset URLs that
 * the module's import graph pulls in (chunks, CSS files, etc.).
 *
 * This is the format Vite emits to `dist/server/.vite/ssr-manifest.json`.
 * Pass it through to enable progressive `<link>` emission for lazy boundaries.
 */
export type SSRManifest = Record<string, string[]>;

export interface RenderOptions {
  nonce?: string; // CSP nonce for injected scripts
  baseHtml?: string; // Optional HTML shell to inject into
  /**
   * Vite SSR manifest. When provided, `renderToStream` emits `<link rel="stylesheet">`
   * tags for each lazy boundary's CSS dependencies inline with the boundary flush.
   * Lazy boundaries without an `id` (i.e. compiler-off `lazy()` calls) get no hints.
   */
  manifest?: SSRManifest;
}

export interface RenderToStringOptions extends RenderOptions {}
export interface RenderToStreamOptions extends RenderOptions {}

/** The return value of renderToString — component HTML and the hydration state script, separately. */
export interface RenderResult {
  /** The rendered component HTML. Inject into your HTML shell at the SSR outlet. */
  html: string;
  /** The `<script>window.__STEWIE_STATE__ = ...</script>` tag. Inject just before `</body>`. */
  stateScript: string;
  /**
   * Serialized `<title>` and `<meta>` tags collected during the render via `useTitle` / `useMeta`.
   * Inject into `<head>` of your HTML shell. Empty string when no head primitives were used.
   */
  headHtml: string;
}
