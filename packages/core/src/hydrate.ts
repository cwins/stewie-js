// hydrate.ts — client-side hydration entrypoint.
// Reads __STEWIE_STATE__ serialized by the server, provides it via context,
// then mounts the app so components can access their initial server state.

import { provide } from './context.js'
import { mount } from './dom-renderer.js'
import { HydrationRegistryContext } from './hydration.js'
import type { HydrationRegistry } from './hydration.js'
import type { JSXElement } from './jsx-runtime.js'
import type { Disposer } from './dom-renderer.js'

declare global {
  interface Window {
    __STEWIE_STATE__?: Record<string, unknown>
  }
}

function createClientRegistry(state: Record<string, unknown>): HydrationRegistry {
  const data = { ...state }
  return {
    get: (key) => data[key],
    set: (key, value) => {
      data[key] = value
    },
    serialize: () => JSON.stringify(data),
  }
}

// ---------------------------------------------------------------------------
// Hydration mismatch detection (dev mode only)
// ---------------------------------------------------------------------------

/**
 * Normalise an HTML string for comparison: collapse whitespace and trim so
 * that insignificant formatting differences don't trigger false positives.
 */
function normaliseHtml(html: string): string {
  return html.replace(/\s+/g, ' ').trim()
}

/**
 * In development, compare the client-rendered HTML against the HTML the
 * server produced. Logs a warning when they differ so developers can catch
 * serialisation bugs early.
 *
 * Only runs when `process.env.NODE_ENV !== 'production'` — tree-shaken away
 * in production builds.
 */
function warnOnMismatch(serverHtml: string, clientHtml: string, container: Element): void {
  const normServer = normaliseHtml(serverHtml)
  const normClient = normaliseHtml(clientHtml)

  if (normServer === normClient) return

  // Build a compact diff: find the first character position that diverges
  const maxLen = Math.max(normServer.length, normClient.length)
  let firstDiff = maxLen
  for (let i = 0; i < maxLen; i++) {
    if (normServer[i] !== normClient[i]) {
      firstDiff = i
      break
    }
  }

  const CONTEXT = 60
  const start = Math.max(0, firstDiff - CONTEXT)
  const serverSnippet = normServer.slice(start, firstDiff + CONTEXT)
  const clientSnippet = normClient.slice(start, firstDiff + CONTEXT)

  console.warn(
    '[stewie] Hydration mismatch detected in',
    container,
    '\n\nServer rendered:\n  …' + serverSnippet + '…' +
    '\n\nClient rendered:\n  …' + clientSnippet + '…' +
    '\n\nThis can cause flickering or lost state. Check that your component ' +
    'renders the same output on server and client.',
  )
}

/**
 * Hydrate a server-rendered page.
 *
 * Reads `window.__STEWIE_STATE__` injected by renderToString(), provides it
 * via HydrationRegistryContext so components can access their initial state,
 * then mounts the app into the container.
 *
 * In development, compares the server-rendered HTML against the client render
 * and logs a warning if they differ (hydration mismatch detection).
 *
 * Returns a dispose function that unmounts the app.
 */
export function hydrate(
  root: JSXElement | Node | (() => JSXElement | Node | null) | null,
  container: Element,
): Disposer {
  const initialState = typeof window !== 'undefined' ? (window.__STEWIE_STATE__ ?? {}) : {}

  // Capture server HTML before we overwrite it (dev only)
  const isDev = process.env.NODE_ENV !== 'production'
  const serverHtml = isDev ? container.innerHTML : ''

  const registry = createClientRegistry(initialState as Record<string, unknown>)

  let disposer!: Disposer
  provide(HydrationRegistryContext, registry, () => {
    disposer = mount(root, container)
  })

  // After mount, compare client output against server HTML.
  // Skip the check when the container was empty — that means this is a
  // fresh client-side mount, not a hydration of server-rendered content.
  if (isDev && serverHtml.trim() !== '') {
    warnOnMismatch(serverHtml, container.innerHTML, container)
  }

  return disposer
}
