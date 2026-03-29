import type { JSXElement } from '@stewie-js/core'
import {
  Fragment,
  Show,
  For,
  Switch,
  Match,
  Portal,
  ErrorBoundary,
  Suspense,
  ClientOnly,
  runWithContext,
  withRenderIsolation,
  createRoot,
} from '@stewie-js/core'
import type { ContextProvider, ContextSnapshot } from '@stewie-js/core'
import type { RenderToStringOptions, RenderResult } from './types.js'
import {
  createHydrationRegistry,
  HydrationRegistryContext,
  type HydrationRegistry,
} from './hydration.js'

// ---------------------------------------------------------------------------
// Void elements — self-closing in HTML
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

// ---------------------------------------------------------------------------
// HTML entity escaping
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// Style object → CSS string
// Converts camelCase keys to kebab-case: fontSize → font-size
// ---------------------------------------------------------------------------

function styleObjectToString(style: Record<string, string | number>): string {
  return Object.entries(style)
    .map(([key, value]) => {
      const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
      return `${kebab}: ${value}`
    })
    .join('; ')
}

// ---------------------------------------------------------------------------
// Attribute serialization
// ---------------------------------------------------------------------------

function serializeAttrs(props: Record<string, unknown>): string {
  let out = ''
  for (const [key, rawValue] of Object.entries(props)) {
    // Skip internal/non-HTML props
    if (key === 'children' || key === 'key' || key === 'ref') continue
    // Skip event handlers (on* pattern)
    if (/^on[A-Z]/.test(key)) continue

    // Resolve reactive (function) values — but not for children (already skipped)
    let value = typeof rawValue === 'function' ? (rawValue as () => unknown)() : rawValue

    // Map className → class
    const attrName = key === 'className' ? 'class' : key

    if (value === null || value === undefined || value === false) {
      // Omit falsy boolean attributes
      continue
    }

    if (value === true) {
      // Boolean presence attribute: <input disabled />
      out += ` ${attrName}`
      continue
    }

    if (attrName === 'style' && typeof value === 'object') {
      value = styleObjectToString(value as Record<string, string | number>)
    }

    out += ` ${attrName}="${escapeHtml(String(value))}"`
  }
  return out
}

// ---------------------------------------------------------------------------
// Internal render options passed through recursion
// ---------------------------------------------------------------------------

interface InternalRenderOptions {
  nonce?: string
  registry: HydrationRegistry
  /** Active context values for this render path — threaded through async boundaries. */
  contextSnapshot: ContextSnapshot
}

// ---------------------------------------------------------------------------
// Core recursive renderer
// ---------------------------------------------------------------------------

async function renderNode(node: unknown, opts: InternalRenderOptions): Promise<string> {
  // Await any promise children (async components)
  if (node instanceof Promise) {
    node = await node
  }

  // Primitives
  if (node === null || node === undefined || node === false || node === true) {
    return ''
  }

  if (typeof node === 'string') {
    return escapeHtml(node)
  }

  if (typeof node === 'number') {
    return escapeHtml(String(node))
  }

  // Arrays (multiple children)
  if (Array.isArray(node)) {
    const parts = await Promise.all(node.map((child) => renderNode(child, opts)))
    return parts.join('')
  }

  // Function child — call it to get the renderable value (used by reactive children
  // like Router's matchedContent, and reactive Show/For props that are functions).
  // The DOM renderer inserts an empty comment anchor after function-child output (<!---->)
  // so we emit one here to keep server and client HTML in sync.
  if (typeof node === 'function') {
    const inner = await renderNode((node as () => unknown)(), opts)
    return `${inner}<!---->`
  }

  // JSXElement descriptor
  const el = node as JSXElement
  const { type, props } = el

  // Fragment
  if (type === Fragment) {
    const children = props.children
    if (children === undefined || children === null) return ''
    return renderNode(children, opts)
  }

  // Built-in control flow components — identified by function reference.
  // Each emits a trailing HTML comment that matches the anchor comment node the DOM
  // renderer inserts so that SSR output and client hydration produce identical HTML.
  if (type === (Show as unknown)) {
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when
    if (when) {
      return `${await renderNode(props.children, opts)}<!--Show-->`
    } else if (props.fallback !== undefined) {
      return `${await renderNode(props.fallback, opts)}<!--Show-->`
    }
    return '<!--Show-->'
  }

  if (type === (For as unknown)) {
    const each =
      typeof props.each === 'function'
        ? (props.each as () => unknown[])()
        : (props.each as unknown[])
    if (!Array.isArray(each)) return '<!--For-->'
    const renderFn = props.children as (item: unknown, index: number) => JSXElement
    const parts = await Promise.all(each.map((item, i) => renderNode(renderFn(item, i), opts)))
    return `${parts.join('')}<!--For-->`
  }

  if (type === (ClientOnly as unknown)) {
    // Never render on server
    return ''
  }

  if (type === (Portal as unknown)) {
    // On server, just render children inline (ignore target)
    return renderNode(props.children, opts)
  }

  if (type === (ErrorBoundary as unknown)) {
    try {
      return await renderNode(props.children, opts)
    } catch (err) {
      const fallbackFn = props.fallback as (err: unknown) => JSXElement
      return renderNode(fallbackFn(err), opts)
    }
  }

  if (type === (Suspense as unknown)) {
    // If a child throws a Promise (e.g. resource().read()), await it and retry.
    //
    // Important: For this to work correctly, the `resource()` that throws must be
    // created OUTSIDE the component function so the same instance is reused on retry.
    // When `resource()` is created inside a component, each retry creates a new
    // resource and a new Promise — in that case retries are capped and the fallback
    // is rendered instead. For SSR data loading, prefer route-level `load()` functions.
    const MAX_RETRIES = 3
    let retries = 0
    const seenPromises = new Set<Promise<unknown>>()
    const tryRender = async (): Promise<string> => {
      try {
        return await renderNode(props.children, opts)
      } catch (thrown) {
        if (thrown instanceof Promise && !seenPromises.has(thrown) && retries < MAX_RETRIES) {
          seenPromises.add(thrown)
          retries++
          try {
            await thrown
          } catch {
            // Promise rejected (fetch failed) — render fallback immediately.
            return renderNode(props.fallback, opts)
          }
          return tryRender()
        }
        // Non-Promise throw, repeated Promise, or retry limit reached → render fallback.
        return renderNode(props.fallback, opts)
      }
    }
    return tryRender()
  }

  if (type === (Switch as unknown)) {
    // Find first matching Match branch
    const children = Array.isArray(props.children) ? props.children : [props.children]
    for (const child of children as JSXElement[]) {
      if (!child || child.type !== (Match as unknown)) continue
      const matchProps = child.props as {
        when: unknown
        children: JSXElement | ((v: unknown) => JSXElement)
      }
      const when =
        typeof matchProps.when === 'function'
          ? (matchProps.when as () => unknown)()
          : matchProps.when
      if (when) {
        const childContent =
          typeof matchProps.children === 'function'
            ? (matchProps.children as (v: unknown) => JSXElement)(when)
            : matchProps.children
        return `${await renderNode(childContent, opts)}<!--Switch-->`
      }
    }
    // No match — render fallback if present
    if (props.fallback !== undefined) {
      return `${await renderNode(props.fallback, opts)}<!--Switch-->`
    }
    return '<!--Switch-->'
  }

  if (type === (Match as unknown)) {
    // Match rendered standalone (outside Switch) — treat like Show
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when
    if (when) {
      const childContent =
        typeof props.children === 'function'
          ? (props.children as (v: unknown) => JSXElement)(when)
          : props.children
      return renderNode(childContent, opts)
    }
    return ''
  }

  // Context.Provider — extend the snapshot with the new value for child rendering
  if (type != null && (typeof type === 'function' || typeof type === 'object') && (type as unknown as ContextProvider<unknown>)._isProvider) {
    const provider = type as unknown as ContextProvider<unknown>
    const newSnapshot = new Map(opts.contextSnapshot)
    newSnapshot.set(provider._context.id, props.value)
    return renderNode(props.children, { ...opts, contextSnapshot: newSnapshot })
  }

  // Component function — restore context snapshot so inject() works throughout the
  // component body, including synchronous inject() calls before any await.
  // createRoot() allows signal/store/computed/effect creation inside components.
  if (typeof type === 'function') {
    let result: JSXElement | null = null
    createRoot(() => {
      runWithContext(opts.contextSnapshot, () => {
        result = (type as (props: Record<string, unknown>) => JSXElement | null)(props)
      })
    })
    return renderNode(result, opts)
  }

  // Intrinsic element (string tag)
  if (typeof type === 'string') {
    const tag = type
    const attrs = serializeAttrs(props)
    const children = props.children

    if (VOID_ELEMENTS.has(tag)) {
      return `<${tag}${attrs} />`
    }

    const innerHtml = children !== undefined ? await renderNode(children, opts) : ''
    return `<${tag}${attrs}>${innerHtml}</${tag}>`
  }

  // Unknown node type — return empty
  return ''
}

// ---------------------------------------------------------------------------
// Public renderToString
// ---------------------------------------------------------------------------

export async function renderToString(
  root: JSXElement | (() => JSXElement | null),
  options?: RenderToStringOptions,
): Promise<RenderResult> {
  // withRenderIsolation clears reactive module-level globals (scopeStack, batchDepth,
  // pendingEffects) and sets allowReactiveCreation=true for the synchronous setup phase,
  // then restores them when the async function returns its Promise. This prevents state
  // leakage between concurrent renders during their synchronous portions.
  return withRenderIsolation(async () => {
  const registry = createHydrationRegistry()
  // Seed the context snapshot with the hydration registry so any component can call
  // useHydrationRegistry() / inject(HydrationRegistryContext) and get the registry.
  const contextSnapshot: ContextSnapshot = new Map([[HydrationRegistryContext.id, registry]])
  const opts: InternalRenderOptions = { nonce: options?.nonce, registry, contextSnapshot }

  const rootEl = typeof root === 'function' ? root() : root
  const html = await renderNode(rootEl, opts)

  // Serialize hydration state — escape </script> to prevent XSS breakout
  const stateJson = registry.serialize().replace(/<\//g, '<\\/')
  const nonceAttr = options?.nonce ? ` nonce="${escapeHtml(options.nonce)}"` : ''
  const stateScript = `<script${nonceAttr}>window.__STEWIE_STATE__ = ${stateJson}</script>`

  return { html, stateScript }
  }) // end withRenderIsolation
}
