// mount.ts — component mounting into an HTML string-based test structure

import type { JSXElement } from '@stewie/core'
import type { Context } from '@stewie/core'
import { provide } from '@stewie/core'
import { renderToString } from '@stewie/server'
import {
  findByText as queryFindByText,
  findByTestId as queryFindByTestId,
  findByRole as queryFindByRole,
} from './queries.js'
import type { ElementHandle } from './queries.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ElementHandle } from './queries.js'

export interface MountOptions {
  // Context values to provide during rendering
  contexts?: Array<{ context: Context<unknown>; value: unknown }>
}

export interface MountResult {
  // The rendered HTML string
  html: string
  // Synchronous query methods — throw if not found
  getByText(text: string): ElementHandle
  getByTestId(id: string): ElementHandle
  getByRole(role: string, options?: { name?: string }): ElementHandle
  // Synchronous query methods — return null if not found
  queryByText(text: string): ElementHandle | null
  queryByTestId(id: string): ElementHandle | null
  queryByRole(role: string, options?: { name?: string }): ElementHandle | null
  // Async queries — for Phase 9 resolve immediately
  findByText(text: string): Promise<ElementHandle>
  findByTestId(id: string): Promise<ElementHandle>
  // Cleanup
  unmount(): void
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function wrapWithContexts(
  root: JSXElement | (() => JSXElement | null),
  contexts: Array<{ context: Context<unknown>; value: unknown }>,
): () => Promise<string> {
  return () => {
    // Nest the provide calls recursively
    function nest(index: number): Promise<string> {
      if (index >= contexts.length) {
        return renderToString(root)
      }
      const { context, value } = contexts[index]
      return provide(context, value, () => nest(index + 1))
    }
    return nest(0)
  }
}

// ---------------------------------------------------------------------------
// mount() — public API
// ---------------------------------------------------------------------------

export async function mount(
  component: JSXElement | (() => JSXElement | null),
  options?: MountOptions,
): Promise<MountResult> {
  let html: string

  if (options?.contexts && options.contexts.length > 0) {
    const renderer = wrapWithContexts(component, options.contexts)
    html = await renderer()
  } else {
    html = await renderToString(component)
  }

  function getByText(text: string): ElementHandle {
    const el = queryFindByText(html, text)
    if (!el) {
      throw new Error(`Unable to find element with text: "${text}"`)
    }
    return el
  }

  function getByTestId(id: string): ElementHandle {
    const el = queryFindByTestId(html, id)
    if (!el) {
      throw new Error(`Unable to find element with data-testid: "${id}"`)
    }
    return el
  }

  function getByRole(role: string, roleOptions?: { name?: string }): ElementHandle {
    const el = queryFindByRole(html, role, roleOptions)
    if (!el) {
      const nameHint = roleOptions?.name ? ` and name "${roleOptions.name}"` : ''
      throw new Error(`Unable to find element with role: "${role}"${nameHint}`)
    }
    return el
  }

  function queryByText(text: string): ElementHandle | null {
    return queryFindByText(html, text)
  }

  function queryByTestId(id: string): ElementHandle | null {
    return queryFindByTestId(html, id)
  }

  function queryByRole(role: string, roleOptions?: { name?: string }): ElementHandle | null {
    return queryFindByRole(html, role, roleOptions)
  }

  async function findByText(text: string): Promise<ElementHandle> {
    // For Phase 9: resolve immediately (no async waiting)
    return getByText(text)
  }

  async function findByTestId(id: string): Promise<ElementHandle> {
    // For Phase 9: resolve immediately (no async waiting)
    return getByTestId(id)
  }

  function unmount(): void {
    // No real DOM to clean up in the string-based approach
  }

  return {
    html,
    getByText,
    getByTestId,
    getByRole,
    queryByText,
    queryByTestId,
    queryByRole,
    findByText,
    findByTestId,
    unmount,
  }
}
