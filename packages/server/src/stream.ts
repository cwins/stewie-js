import type { JSXElement } from '@stewie/core'
import type { RenderToStreamOptions } from './types.js'
import { renderToString } from './renderer.js'

export function renderToStream(
  root: JSXElement | (() => JSXElement | null),
  options?: RenderToStreamOptions
): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      try {
        const html = await renderToString(root, options)
        controller.enqueue(html)
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    }
  })
}
