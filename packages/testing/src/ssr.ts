// ssr.ts — SSR test helpers

import type { JSXElement } from '@stewie-js/core'
import { renderToString as serverRenderToString } from '@stewie-js/server'
import type { RenderResult } from '@stewie-js/server'

// SSR test helper — renders a component using the server renderer.
// Returns { html, stateScript } so tests can assert on both content and hydration state.
export async function renderToString(
  component: JSXElement | (() => JSXElement | null),
): Promise<RenderResult> {
  return serverRenderToString(component)
}
