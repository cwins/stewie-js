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

/**
 * Build the event-handler part of a two-way binding, picking the right DOM
 * event and target property based on element type and bound prop.
 *
 * Rules:
 * - `$checked` on `<input>` → onChange + e.target.checked (checkbox pattern)
 * - `$value` on `<select>` → onChange + e.target.value (select fires change, not input)
 * - everything else → onInput + e.target.value
 */
function buildTwoWayHandler(expr: string, elementName: string, propName: string): string {
  if (propName === 'checked') {
    return `onChange={(e: Event) => ${expr}.set((e.target as HTMLInputElement).checked)}`
  }
  if (elementName === 'select') {
    return `onChange={(e: Event) => ${expr}.set((e.target as HTMLSelectElement).value)}`
  }
  return `onInput={(e: InputEvent) => ${expr}.set((e.target as HTMLInputElement).value)}`
}

export function transformFile(
  parsed: ParsedFile,
  analysis: AnalysisResult,
  options: { jsxToDom?: boolean } = {},
): string {
  let source = parsed.source
  const replacements: Replacement[] = []

  // Auto-wrap: reactive reads in JSX expressions that aren't already functions
  for (const candidate of analysis.autoWrapCandidates) {
    replacements.push({
      start: candidate.start,
      end: candidate.end,
      text: `{() => ${candidate.expressionText}}`,
    })
  }

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
      // Full two-way binding — event and accessor depend on element + prop
      const twoWayHandler = buildTwoWayHandler(expr, binding.elementName, binding.propName)
      replacement = `${binding.propName}={${expr}()} ${twoWayHandler}`
    }

    replacements.push({
      start: found.start,
      end: found.end,
      text: replacement,
    })
  }

  // Collect JSX-to-DOM replacements (if enabled)
  const jsxReplacements = options.jsxToDom ? findJsxReplacements(parsed.sourceFile) : []

  // Filter auto-wrap and $prop replacements that fall inside a jsxToDom range.
  // jsxToDom emits those expressions as DOM setup code — applying a text
  // replacement at the original offset would corrupt the already-replaced region.
  const filteredReplacements =
    jsxReplacements.length === 0
      ? replacements
      : replacements.filter(
          (r) =>
            !jsxReplacements.some((jsx) => r.start >= jsx.start && r.end <= jsx.end),
        )

  // Merge all replacements and sort in reverse source order
  const allReplacements: Array<{ start: number; end: number; text: string }> = [
    ...filteredReplacements.map((r) => ({ start: r.start, end: r.end, text: r.text })),
    ...jsxReplacements.map((r) => ({ start: r.start, end: r.end, text: r.replacement })),
  ]
  allReplacements.sort((a, b) => b.start - a.start)

  for (const rep of allReplacements) {
    source = source.slice(0, rep.start) + rep.text + source.slice(rep.end)
  }

  // If JSX-to-DOM was applied, ensure `effect` is imported from @stewie-js/core.
  // Merge into an existing named import rather than adding a duplicate import.
  if (options.jsxToDom && jsxReplacements.length > 0) {
    const alreadyImportsEffect = /\bimport\b[^;]*\beffect\b[^;]*from\s*['"]@stewie-js\/core['"]/.test(source)
    if (!alreadyImportsEffect) {
      // Check for an existing @stewie-js/core import to merge into
      const existingImportMatch = source.match(
        /import\s*\{([^}]*)\}\s*from\s*['"]@stewie-js\/core['"]/,
      )
      if (existingImportMatch) {
        // Add `effect` to the existing named imports
        const newImport = existingImportMatch[0].replace(
          `{${existingImportMatch[1]}}`,
          `{${existingImportMatch[1].trimEnd().replace(/,?\s*$/, '')}, effect }`,
        )
        source = source.replace(existingImportMatch[0], newImport)
      } else {
        source = `import { effect } from '@stewie-js/core'\n` + source
      }
    }
  }

  return source
}
