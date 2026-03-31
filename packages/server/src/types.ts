import type { JSXElement } from '@stewie-js/core';

export type Component = () => JSXElement | null | string;

export interface RenderOptions {
  nonce?: string; // CSP nonce for injected scripts
  baseHtml?: string; // Optional HTML shell to inject into
}

export interface RenderToStringOptions extends RenderOptions {}
export interface RenderToStreamOptions extends RenderOptions {}

/** The return value of renderToString — component HTML and the hydration state script, separately. */
export interface RenderResult {
  /** The rendered component HTML. Inject into your HTML shell at the SSR outlet. */
  html: string;
  /** The `<script>window.__STEWIE_STATE__ = ...</script>` tag. Inject just before `</body>`. */
  stateScript: string;
}
