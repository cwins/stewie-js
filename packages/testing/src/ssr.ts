// ssr.ts — SSR test helpers

import type { JSXElement } from '@stewie/core'
import { renderToString as serverRenderToString } from '@stewie/server'

// SSR test helper — renders a component to an HTML string using the server renderer.
export async function renderToString(
  component: JSXElement | (() => JSXElement | null),
): Promise<string> {
  return serverRenderToString(component)
}
