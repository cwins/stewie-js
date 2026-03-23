// mount.ts — DOM-based component mounting for interactive reactive tests.
//
// Requires a DOM environment. Add this to the top of your test file:
//   // @vitest-environment happy-dom
//
// Unlike an SSR-string approach, this uses the real DOM renderer so signals
// trigger live updates — no re-render step needed after changing reactive state.

import { mount as coreMount, jsx } from '@stewie/core'
import type { JSXElement, Component } from '@stewie/core'
import type { Context } from '@stewie/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ElementHandle {
  tagName: string
  textContent: string
  getAttribute(name: string): string | null
  innerHTML: string
  outerHTML: string
}

export interface MountOptions {
  /** Context values to provide to the rendered component tree. */
  contexts?: Array<{ context: Context<unknown>; value: unknown }>
}

export interface MountResult {
  /** The DOM container the component was mounted into. */
  container: HTMLElement
  /** Current inner HTML of the container (snapshot at call time). */
  html: string
  // Synchronous queries — throw if not found
  getByText(text: string): ElementHandle
  getByTestId(id: string): ElementHandle
  getByRole(role: string, options?: { name?: string }): ElementHandle
  // Synchronous queries — return null if not found
  queryByText(text: string): ElementHandle | null
  queryByTestId(id: string): ElementHandle | null
  queryByRole(role: string, options?: { name?: string }): ElementHandle | null
  // Async queries — polls until element appears or timeout
  findByText(text: string, options?: { timeout?: number }): Promise<ElementHandle>
  findByTestId(id: string, options?: { timeout?: number }): Promise<ElementHandle>
  // Cleanup
  unmount(): void
}

// ---------------------------------------------------------------------------
// ElementHandle helpers
// ---------------------------------------------------------------------------

function toHandle(el: Element): ElementHandle {
  return {
    get tagName() { return el.tagName.toLowerCase() },
    get textContent() { return el.textContent ?? '' },
    getAttribute(name: string) { return el.getAttribute(name) },
    get innerHTML() { return el.innerHTML },
    get outerHTML() { return el.outerHTML },
  }
}

// ---------------------------------------------------------------------------
// DOM queries
// ---------------------------------------------------------------------------

function queryTestId(container: Element, id: string): ElementHandle | null {
  const el = container.querySelector(`[data-testid="${CSS.escape(id)}"]`)
  return el ? toHandle(el) : null
}

function queryText(container: Element, text: string): ElementHandle | null {
  // Find the most specific element containing the text — prefer leaf nodes.
  const all = Array.from(container.querySelectorAll('*'))
  const matches = all.filter((el) => (el.textContent ?? '').includes(text))
  // Sort ascending by text length — shorter = more specific
  matches.sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length)
  return matches[0] ? toHandle(matches[0]) : null
}

// ARIA role → CSS selector
const ROLE_SELECTOR: Record<string, string> = {
  button: 'button, [role="button"]',
  link: 'a',
  textbox: 'input:not([type]), input[type="text"], input[type="email"], input[type="search"], input[type="url"], input[type="tel"], textarea',
  checkbox: 'input[type="checkbox"]',
  radio: 'input[type="radio"]',
  heading: 'h1, h2, h3, h4, h5, h6',
  listitem: 'li',
  list: 'ul, ol',
  navigation: 'nav',
  main: 'main',
  banner: 'header',
  contentinfo: 'footer',
  article: 'article',
  region: 'section',
  form: 'form',
  img: 'img',
}

function queryRole(
  container: Element,
  role: string,
  options?: { name?: string },
): ElementHandle | null {
  const selector = ROLE_SELECTOR[role] ?? `[role="${role}"]`
  const candidates = Array.from(container.querySelectorAll(selector))

  for (const el of candidates) {
    if (options?.name) {
      const ariaLabel = el.getAttribute('aria-label')
      const ariaLabelledBy = el.getAttribute('aria-labelledby')
      let name = ariaLabel ?? ''
      if (!name && ariaLabelledBy) {
        const labelEl = container.ownerDocument?.getElementById(ariaLabelledBy)
        name = labelEl?.textContent ?? ''
      }
      if (!name) name = el.textContent ?? ''
      if (!name.includes(options.name)) continue
    }
    return toHandle(el)
  }
  return null
}

// ---------------------------------------------------------------------------
// Async polling helper
// ---------------------------------------------------------------------------

async function pollFor(
  query: () => ElementHandle | null,
  timeout = 1000,
): Promise<ElementHandle> {
  const start = Date.now()
  while (true) {
    const result = query()
    if (result) return result
    if (Date.now() - start > timeout) throw new Error('Timeout waiting for element')
    await new Promise((r) => setTimeout(r, 16))
  }
}

// ---------------------------------------------------------------------------
// mount() — public API
// ---------------------------------------------------------------------------

export function mount(
  component: JSXElement | (() => JSXElement | null),
  options?: MountOptions,
): MountResult {
  if (typeof document === 'undefined') {
    throw new Error(
      '@stewie/testing mount() requires a DOM environment.\n' +
        'Add // @vitest-environment happy-dom to the top of your test file.',
    )
  }

  const container = document.createElement('div')
  document.body.appendChild(container)

  // Wrap the component in any requested context providers
  let root: JSXElement | (() => JSXElement | null) = component
  for (const { context, value } of [...(options?.contexts ?? [])].reverse()) {
    const child = root
    root = jsx(context.Provider as unknown as Component, { value, children: child })
  }

  // Mount into the real DOM — reactive effects are live immediately
  const dispose = coreMount(root as JSXElement, container)

  function unmount() {
    dispose()
    if (container.parentNode) container.parentNode.removeChild(container)
  }

  return {
    container: container as HTMLElement,
    get html() { return container.innerHTML },

    getByText(text: string) {
      const el = queryText(container, text)
      if (!el) throw new Error(`Unable to find element with text: "${text}"`)
      return el
    },
    getByTestId(id: string) {
      const el = queryTestId(container, id)
      if (!el) throw new Error(`Unable to find element with data-testid: "${id}"`)
      return el
    },
    getByRole(role: string, opts?: { name?: string }) {
      const el = queryRole(container, role, opts)
      if (!el) {
        const namePart = opts?.name ? ` and name "${opts.name}"` : ''
        throw new Error(`Unable to find element with role: "${role}"${namePart}`)
      }
      return el
    },

    queryByText: (text: string) => queryText(container, text),
    queryByTestId: (id: string) => queryTestId(container, id),
    queryByRole: (role: string, opts?: { name?: string }) => queryRole(container, role, opts),

    findByText: (text: string, opts?: { timeout?: number }) =>
      pollFor(() => queryText(container, text), opts?.timeout),
    findByTestId: (id: string, opts?: { timeout?: number }) =>
      pollFor(() => queryTestId(container, id), opts?.timeout),

    unmount,
  }
}
