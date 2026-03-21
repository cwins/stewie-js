import type { JSXElement } from '@stewie/core'

export type Component = () => JSXElement | null | string

export interface RenderOptions {
  nonce?: string         // CSP nonce for injected scripts
  baseHtml?: string      // Optional HTML shell to inject into
}

export interface RenderToStringOptions extends RenderOptions {}
export interface RenderToStreamOptions extends RenderOptions {}
