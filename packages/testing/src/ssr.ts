// ssr.ts — SSR test helpers

import type { JSXElement } from '@stewie/core'
import { renderToString as serverRenderToString } from '@stewie/server'
import type { RenderResult } from '@stewie/server'

// SSR test helper — renders a component using the server renderer.
// Returns { html, stateScript } so tests can assert on both content and hydration state.
export async function renderToString(
  component: JSXElement | (() => JSXElement | null),
): Promise<RenderResult> {
  return serverRenderToString(component)
}
