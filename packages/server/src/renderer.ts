import type { JSXElement } from '@stewie/core'
import { Fragment, Show, For, Switch, Match, Portal, ErrorBoundary, Suspense, ClientOnly, provide } from '@stewie/core'
import type { RenderToStringOptions } from './types.js'
import { createHydrationRegistry, HydrationRegistryContext } from './hydration.js'

// ---------------------------------------------------------------------------
// Void elements — self-closing in HTML
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
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
    return String(node)
  }

  // Arrays (multiple children)
  if (Array.isArray(node)) {
    const parts = await Promise.all(node.map((child) => renderNode(child, opts)))
    return parts.join('')
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

  // Built-in control flow components — identified by function reference
  if (type === (Show as unknown)) {
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when
    if (when) {
      return renderNode(props.children, opts)
    } else if (props.fallback !== undefined) {
      return renderNode(props.fallback, opts)
    }
    return ''
  }

  if (type === (For as unknown)) {
    const each = typeof props.each === 'function'
      ? (props.each as () => unknown[])()
      : (props.each as unknown[])
    if (!Array.isArray(each)) return ''
    const renderFn = props.children as (item: unknown, index: number) => JSXElement
    const parts = await Promise.all(each.map((item, i) => renderNode(renderFn(item, i), opts)))
    return parts.join('')
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
    try {
      return await renderNode(props.children, opts)
    } catch (_err) {
      // If rendering throws (e.g. a promise is thrown), fall back to fallback
      return renderNode(props.fallback, opts)
    }
  }

  if (type === (Switch as unknown)) {
    // Find first matching Match branch
    const children = Array.isArray(props.children) ? props.children : [props.children]
    for (const child of children as JSXElement[]) {
      if (!child || child.type !== (Match as unknown)) continue
      const matchProps = child.props as { when: unknown; children: JSXElement | ((v: unknown) => JSXElement) }
      const when = typeof matchProps.when === 'function'
        ? (matchProps.when as () => unknown)()
        : matchProps.when
      if (when) {
        const childContent = typeof matchProps.children === 'function'
          ? (matchProps.children as (v: unknown) => JSXElement)(when)
          : matchProps.children
        return renderNode(childContent, opts)
      }
    }
    // No match — render fallback if present
    if (props.fallback !== undefined) {
      return renderNode(props.fallback, opts)
    }
    return ''
  }

  if (type === (Match as unknown)) {
    // Match rendered standalone (outside Switch) — treat like Show
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when
    if (when) {
      const childContent = typeof props.children === 'function'
        ? (props.children as (v: unknown) => JSXElement)(when)
        : props.children
      return renderNode(childContent, opts)
    }
    return ''
  }

  // Component function
  if (typeof type === 'function') {
    const result = (type as (props: Record<string, unknown>) => JSXElement | null)(props)
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
  options?: RenderToStringOptions
): Promise<string> {
  const registry = createHydrationRegistry()
  const opts: InternalRenderOptions = { nonce: options?.nonce }

  const rootEl = typeof root === 'function' ? root() : root

  let html = ''
  await provide(HydrationRegistryContext, registry, async () => {
    html = await renderNode(rootEl, opts)
  })

  // Serialize hydration state and append script tag
  const stateJson = registry.serialize()
  const nonceAttr = options?.nonce ? ` nonce="${escapeHtml(options.nonce)}"` : ''
  const stateScript = `<script${nonceAttr}>__STEWIE_STATE__ = ${stateJson}</script>`

  return html + stateScript
}
