/**
 * dom-emitter.ts — JSX-to-DOM transformation
 *
 * Transforms native HTML JSX elements into direct DOM creation code:
 *   <div class="foo">{count}</div>
 *   →
 *   (() => {
 *     const __el0 = document.createElement('div')
 *     __el0.className = 'foo'
 *     const __t1 = document.createTextNode('')
 *     effect(() => { __t1.nodeValue = String(count()) })
 *     __el0.appendChild(__t1)
 *     return __el0
 *   })()
 *
 * Only native elements (lowercase tag names) are transformed. JSX that
 * contains component children is left untransformed (the fallback JSX runtime
 * handles it). This is the "compiler-driven" approach that eliminates the
 * virtual DOM for static and lightly-dynamic subtrees.
 */

import ts from 'typescript'

// ---------------------------------------------------------------------------
// Reactive expression detection
// ---------------------------------------------------------------------------

/**
 * Returns true if `expr` is reactive (arrow/function expression, or a zero-arg
 * call which is the signal-read pattern `mySignal()`).
 */
function isReactive(expr: ts.Expression): boolean {
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return true
  if (ts.isCallExpression(expr) && expr.arguments.length === 0) return true
  return false
}

/**
 * Return the source text of an expression, wrapping arrow/function expressions
 * in parens if needed to call them as getters.
 */
function asGetter(expr: ts.Expression, sourceFile: ts.SourceFile): string {
  const text = expr.getText(sourceFile)
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    return `(${text})()`
  }
  return text // zero-arg call — already a call expression
}

// ---------------------------------------------------------------------------
// Attribute name mapping
// ---------------------------------------------------------------------------

const PROP_MAP: Record<string, string> = {
  class: 'className',
  className: 'className',
  for: 'htmlFor',
  htmlFor: 'htmlFor',
  tabindex: 'tabIndex',
  tabIndex: 'tabIndex',
  readonly: 'readOnly',
  readOnly: 'readOnly',
  maxlength: 'maxLength',
  maxLength: 'maxLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
}

function toDomProp(attrName: string): { prop: string; useSetAttribute: boolean } {
  if (PROP_MAP[attrName]) return { prop: PROP_MAP[attrName], useSetAttribute: false }
  // aria-*, data-*, custom attributes → setAttribute
  if (attrName.startsWith('aria-') || attrName.startsWith('data-') || attrName.includes('-')) {
    return { prop: attrName, useSetAttribute: true }
  }
  return { prop: attrName, useSetAttribute: false }
}

function isEventHandler(attrName: string): boolean {
  return attrName.length > 2 && /^on[A-Z]/.test(attrName)
}

function eventName(attrName: string): string {
  return attrName.slice(2).toLowerCase()
}

// ---------------------------------------------------------------------------
// Transformability check
// ---------------------------------------------------------------------------

/**
 * Returns true if this JSX subtree can be fully transformed to direct DOM code.
 * A subtree is transformable when:
 *   - The root element is a native HTML element (lowercase tag name), and
 *   - Every JSX child element is also transformable (recursively).
 * Component children, fragments as root, and spread attributes prevent
 * transformation of that subtree.
 */
export function canTransformJsx(
  node: ts.JsxChild | ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment,
  sourceFile: ts.SourceFile,
): boolean {
  if (ts.isJsxText(node)) return true
  if (ts.isJsxExpression(node)) return true

  if (ts.isJsxFragment(node)) {
    // Fragments at the top level — only transform if all children are native
    return Array.from(node.children).every((c) => canTransformJsx(c, sourceFile))
  }

  const opening = ts.isJsxElement(node) ? node.openingElement : node // self-closing
  if (!ts.isJsxOpeningElement(opening) && !ts.isJsxSelfClosingElement(opening)) return false

  const tagName = opening.tagName.getText(sourceFile)
  if (!/^[a-z]/.test(tagName)) return false // Component — cannot transform

  // Check for spread attributes or $prop attributes (handled by the $prop transformer)
  for (const attr of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attr)) return false
    if (ts.isJsxAttribute(attr)) {
      const name = ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText(sourceFile)
      if (name.startsWith('$')) return false
    }
  }

  // Recurse into children
  if (ts.isJsxElement(node)) {
    return Array.from(node.children).every((c) => canTransformJsx(c, sourceFile))
  }

  return true
}

// ---------------------------------------------------------------------------
// Code emitter
// ---------------------------------------------------------------------------

interface Counter {
  n: number
}

interface EmitResult {
  /** Lines of setup code (variable declarations, effect() calls, appendChild calls). */
  lines: string[]
  /** The variable name that holds the root DOM element/node. */
  varName: string
}

/**
 * Emit DOM setup code for a transformable JSX expression.
 * The caller wraps the result in an IIFE:
 *   `(() => { ...lines; return varName })()`
 */
export function emitJsxToDom(
  node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment,
  sourceFile: ts.SourceFile,
  counter: Counter,
): EmitResult {
  if (ts.isJsxFragment(node)) {
    return emitFragment(Array.from(node.children), sourceFile, counter)
  }
  return emitElement(node, sourceFile, counter)
}

function emitFragment(
  children: ts.JsxChild[],
  sourceFile: ts.SourceFile,
  counter: Counter,
): EmitResult {
  const fragVar = `__frag${counter.n++}`
  const lines: string[] = [`const ${fragVar} = document.createDocumentFragment()`]

  for (const child of children) {
    const childResult = emitChild(child, sourceFile, counter)
    if (childResult) {
      lines.push(...childResult.lines)
      lines.push(`${fragVar}.appendChild(${childResult.varName})`)
    }
  }
  return { lines, varName: fragVar }
}

function emitElement(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  counter: Counter,
): EmitResult {
  const opening = ts.isJsxElement(node) ? node.openingElement : node
  const tagName = opening.tagName.getText(sourceFile)
  const elVar = `__el${counter.n++}`
  const lines: string[] = []

  lines.push(`const ${elVar} = document.createElement(${JSON.stringify(tagName)})`)

  // Emit attributes
  for (const attr of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue

    const attrName = ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText(sourceFile)

    if (!attr.initializer) {
      // Boolean attribute (e.g. `disabled`)
      lines.push(`${elVar}.setAttribute(${JSON.stringify(attrName)}, "")`)
      continue
    }

    if (ts.isStringLiteral(attr.initializer)) {
      // Static string value
      const { prop, useSetAttribute } = toDomProp(attrName)
      if (useSetAttribute) {
        lines.push(`${elVar}.setAttribute(${JSON.stringify(attrName)}, ${JSON.stringify(attr.initializer.text)})`)
      } else {
        lines.push(`${elVar}.${prop} = ${JSON.stringify(attr.initializer.text)}`)
      }
      continue
    }

    if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
      const expr = attr.initializer.expression

      // Event handler
      if (isEventHandler(attrName)) {
        const evtName = eventName(attrName)
        const exprText = expr.getText(sourceFile)
        lines.push(`${elVar}.addEventListener(${JSON.stringify(evtName)}, ${exprText})`)
        continue
      }

      const { prop, useSetAttribute } = toDomProp(attrName)

      if (isReactive(expr)) {
        const getter = asGetter(expr, sourceFile)
        if (useSetAttribute) {
          lines.push(
            `effect(() => { ${elVar}.setAttribute(${JSON.stringify(attrName)}, String(${getter})) })`,
          )
        } else {
          lines.push(`effect(() => { ${elVar}.${prop} = ${getter} })`)
        }
      } else {
        // Static expression
        const exprText = expr.getText(sourceFile)
        if (useSetAttribute) {
          lines.push(`${elVar}.setAttribute(${JSON.stringify(attrName)}, String(${exprText}))`)
        } else {
          lines.push(`${elVar}.${prop} = ${exprText}`)
        }
      }
    }
  }

  // Emit children
  const children = ts.isJsxElement(node) ? Array.from(node.children) : []
  for (const child of children) {
    const childResult = emitChild(child, sourceFile, counter)
    if (childResult) {
      lines.push(...childResult.lines)
      lines.push(`${elVar}.appendChild(${childResult.varName})`)
    }
  }

  return { lines, varName: elVar }
}

function emitChild(
  child: ts.JsxChild,
  sourceFile: ts.SourceFile,
  counter: Counter,
): EmitResult | null {
  // Text node
  if (ts.isJsxText(child)) {
    const text = child.text
    // Trim whitespace-only text between elements
    const trimmed = text.trim()
    if (!trimmed) return null
    const tVar = `__t${counter.n++}`
    return {
      lines: [`const ${tVar} = document.createTextNode(${JSON.stringify(trimmed)})`],
      varName: tVar,
    }
  }

  // Expression child: {expr}
  if (ts.isJsxExpression(child)) {
    if (!child.expression) return null

    const expr = child.expression

    if (isReactive(expr)) {
      const tVar = `__t${counter.n++}`
      const getter = asGetter(expr, sourceFile)
      return {
        lines: [
          `const ${tVar} = document.createTextNode('')`,
          `effect(() => { ${tVar}.nodeValue = String(${getter}) })`,
        ],
        varName: tVar,
      }
    }

    // Static expression — create text node once
    const tVar = `__t${counter.n++}`
    const exprText = expr.getText(sourceFile)
    return {
      lines: [`const ${tVar} = document.createTextNode(String(${exprText}))`],
      varName: tVar,
    }
  }

  // Nested JSX element (only native elements reach here — ensured by canTransformJsx)
  if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
    return emitElement(child, sourceFile, counter)
  }

  if (ts.isJsxFragment(child)) {
    return emitFragment(Array.from(child.children), sourceFile, counter)
  }

  return null
}

// ---------------------------------------------------------------------------
// Top-level: find and replace JSX expressions in source
// ---------------------------------------------------------------------------

export interface JsxReplacement {
  /** Character offset start in the original source. */
  start: number
  /** Character offset end (exclusive). */
  end: number
  /** Replacement IIFE code. */
  replacement: string
}

/**
 * Walk the parsed source file and find JSX expressions that can be
 * transformed to direct DOM code. Returns replacements sorted in
 * reverse source order (so applying them doesn't shift earlier offsets).
 */
export function findJsxReplacements(sourceFile: ts.SourceFile): JsxReplacement[] {
  const replacements: JsxReplacement[] = []
  const counter: Counter = { n: 0 }

  function visit(node: ts.Node): void {
    // Look for JSX elements/fragments that are the direct value of a return
    // statement or a variable initializer. These are the common patterns:
    //   return <div>...</div>
    //   const el = <div>...</div>
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    ) {
      if (canTransformJsx(node, sourceFile)) {
        const result = emitJsxToDom(
          node as ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment,
          sourceFile,
          counter,
        )

        const setupCode = result.lines.join('\n    ')
        const iife = `(() => {\n    ${setupCode}\n    return ${result.varName}\n  })()`

        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: iife,
        })

        // Don't recurse into children — we've already emitted them inline
        return
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  // Sort in reverse order so replacements don't shift each other's offsets
  replacements.sort((a, b) => b.start - a.start)
  return replacements
}
