// transformer.ts — rewrites $prop bindings and (optionally) JSX-to-DOM

import type { ParsedFile } from './parser.js'
import type { AnalysisResult } from './analyzer.js'
import { findJsxReplacements } from './dom-emitter.js'

// Represents a text replacement in the source
interface Replacement {
  start: number
  end: number
  text: string
}

/**
 * Find the character offset of a given line/column (1-based) in the source.
 */
function lineColToOffset(source: string, line: number, column: number): number {
  let currentLine = 1
  let i = 0
  while (i < source.length) {
    if (currentLine === line) {
      return i + column - 1
    }
    if (source[i] === '\n') {
      currentLine++
    }
    i++
  }
  return i
}

/**
 * Find a JSX attribute `$propName={...}` starting at or after `searchFrom`,
 * and return the start/end positions and expression text.
 */
function findDollarPropAttr(
  source: string,
  propName: string,
  searchFrom: number,
): { start: number; end: number; expression: string } | null {
  const attrName = `$${propName}`
  // We look forward from searchFrom for `$propName={`
  let idx = source.indexOf(attrName, searchFrom)
  while (idx !== -1) {
    // Make sure this is a whole attribute name (preceded by whitespace or start)
    const before = source[idx - 1]
    if (
      before !== undefined &&
      before !== ' ' &&
      before !== '\t' &&
      before !== '\n' &&
      before !== '\r'
    ) {
      idx = source.indexOf(attrName, idx + 1)
      continue
    }

    // After the attr name, expect `={`
    const afterAttr = idx + attrName.length
    // skip optional whitespace
    let pos = afterAttr
    while (pos < source.length && (source[pos] === ' ' || source[pos] === '\t')) {
      pos++
    }
    if (source[pos] !== '=') {
      idx = source.indexOf(attrName, idx + 1)
      continue
    }
    pos++ // skip '='
    while (pos < source.length && (source[pos] === ' ' || source[pos] === '\t')) {
      pos++
    }
    if (source[pos] !== '{') {
      idx = source.indexOf(attrName, idx + 1)
      continue
    }

    // Now find the matching '}'
    const exprStart = pos + 1
    let depth = 1
    let j = exprStart
    while (j < source.length && depth > 0) {
      if (source[j] === '{') depth++
      else if (source[j] === '}') depth--
      j++
    }

    const expression = source.slice(exprStart, j - 1)
    return { start: idx, end: j, expression }
  }

  return null
}

export function transformFile(
  parsed: ParsedFile,
  analysis: AnalysisResult,
  options: { jsxToDom?: boolean } = {},
): string {
  let source = parsed.source
  const replacements: Replacement[] = []

  for (const binding of analysis.twoWayBindings) {
    if (binding.hasConflictingValue) {
      // Don't transform conflicting bindings; let validator handle this
      continue
    }

    const expr = binding.signalExpression

    // Find the offset to start searching from (use line/column as a hint)
    const searchFrom = lineColToOffset(source, binding.line, binding.column)

    // Find the actual `$propName={...}` in source
    const found = findDollarPropAttr(source, binding.propName, searchFrom)
    if (!found) continue

    let replacement: string
    if (binding.hasReadonly || binding.hasDisabled) {
      // One-way binding only
      replacement = `${binding.propName}={${expr}()}`
    } else {
      // Full two-way binding
      replacement = `${binding.propName}={${expr}()} onInput={(e: InputEvent) => ${expr}.set((e.target as HTMLInputElement).value)}`
    }

    replacements.push({
      start: found.start,
      end: found.end,
      text: replacement,
    })
  }

  // Collect JSX-to-DOM replacements (if enabled)
  const jsxReplacements = options.jsxToDom ? findJsxReplacements(parsed.sourceFile) : []

  // Merge all replacements and sort in reverse source order
  type AnyReplacement = { start: number; end: number; text?: string; replacement?: string }
  const allReplacements: AnyReplacement[] = [
    ...replacements.map((r) => ({ ...r, text: r.text })),
    ...jsxReplacements.map((r) => ({ start: r.start, end: r.end, text: r.replacement })),
  ]
  allReplacements.sort((a, b) => b.start - a.start)

  for (const rep of allReplacements) {
    source = source.slice(0, rep.start) + (rep.text ?? '') + source.slice(rep.end)
  }

  // If JSX-to-DOM was applied, inject the `effect` import if not already present.
  // We add it to the top of the file so generated code can reference effect().
  if (options.jsxToDom && jsxReplacements.length > 0) {
    if (!source.includes("from '@stewie/core'") && !source.includes('from "@stewie/core"')) {
      source = `import { effect } from '@stewie/core'\n` + source
    }
  }

  return source
}
