// analyzer.ts — walk the AST and identify reactive patterns

import ts from 'typescript'
import type { ParsedFile } from './parser.js'

export interface ReactiveAttribute {
  elementName: string
  attributeName: string
  isReactive: boolean
  line: number
  column: number
}

export interface TwoWayBinding {
  elementName: string
  propName: string           // e.g. 'value' from '$value'
  signalExpression: string   // the expression passed to $value={...}
  hasReadonly: boolean
  hasDisabled: boolean
  hasConflictingValue: boolean  // has both $value and value
  line: number
  column: number
}

export interface ModuleScopeCall {
  callee: string    // 'signal' | 'store' | 'computed' | 'effect'
  line: number
  column: number
}

export interface BindingConflict {
  type: 'conflict' | 'readonly' | 'disabled'
  propName: string
  line: number
  column: number
}

export interface AnalysisResult {
  reactiveAttributes: ReactiveAttribute[]
  twoWayBindings: TwoWayBinding[]
  moduleScopeReactiveCalls: ModuleScopeCall[]
  bindingConflicts: BindingConflict[]
}

const REACTIVE_CALLEES = new Set(['signal', 'store', 'computed', 'effect'])

function isTopLevel(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  // A node is top-level if its parent is the SourceFile
  return node.parent === sourceFile
}

function getLineAndColumn(
  node: ts.Node,
  sourceFile: ts.SourceFile
): { line: number; column: number } {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  return { line: line + 1, column: character + 1 }
}

function isReactiveExpression(expr: ts.Expression): boolean {
  // Arrow function or function expression => reactive
  if (
    ts.isArrowFunction(expr) ||
    ts.isFunctionExpression(expr)
  ) {
    return true
  }
  // Call expression with no args => likely a signal read (e.g. mySignal())
  if (ts.isCallExpression(expr) && expr.arguments.length === 0) {
    return true
  }
  return false
}

function getJsxElementName(node: ts.JsxOpeningLikeElement): string {
  const tagName = node.tagName
  return tagName.getText()
}

export function analyzeFile(parsed: ParsedFile): AnalysisResult {
  const { sourceFile } = parsed

  const reactiveAttributes: ReactiveAttribute[] = []
  const twoWayBindings: TwoWayBinding[] = []
  const moduleScopeReactiveCalls: ModuleScopeCall[] = []
  const bindingConflicts: BindingConflict[] = []

  function visitModuleScope(node: ts.Node): void {
    // Check for reactive calls at module scope
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      REACTIVE_CALLEES.has(node.expression.text)
    ) {
      // Walk up to find the statement, which should be a direct child of SourceFile
      let current: ts.Node = node
      while (current.parent && current.parent !== sourceFile) {
        // If we cross a function boundary, it's not module scope
        if (
          ts.isFunctionDeclaration(current.parent) ||
          ts.isFunctionExpression(current.parent) ||
          ts.isArrowFunction(current.parent) ||
          ts.isMethodDeclaration(current.parent) ||
          ts.isClassDeclaration(current.parent) ||
          ts.isClassExpression(current.parent) ||
          ts.isBlock(current.parent)
        ) {
          return
        }
        current = current.parent
      }

      // current.parent === sourceFile => top-level statement
      if (current.parent === sourceFile) {
        const pos = getLineAndColumn(node, sourceFile)
        moduleScopeReactiveCalls.push({
          callee: (node.expression as ts.Identifier).text,
          line: pos.line,
          column: pos.column,
        })
      }
    }
  }

  function visitJsxElement(node: ts.JsxOpeningLikeElement): void {
    const elementName = getJsxElementName(node)
    const attrs = node.attributes.properties

    // Collect all attribute names for conflict detection
    const attrNames = new Map<string, ts.JsxAttribute>()
    for (const attr of attrs) {
      if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name)) {
        attrNames.set(attr.name.text, attr)
      }
    }

    for (const attr of attrs) {
      if (!ts.isJsxAttribute(attr)) continue
      if (!ts.isIdentifier(attr.name)) continue

      const attrName = attr.name.text
      const pos = getLineAndColumn(attr, sourceFile)

      // Check for $prop two-way bindings
      if (attrName.startsWith('$')) {
        const propName = attrName.slice(1)  // strip '$'

        let signalExpr = ''
        if (
          attr.initializer &&
          ts.isJsxExpression(attr.initializer) &&
          attr.initializer.expression
        ) {
          signalExpr = attr.initializer.expression.getText(sourceFile)
        }

        const hasReadonly = attrNames.has('readonly') || attrNames.has('readOnly')
        const hasDisabled = attrNames.has('disabled')
        const hasConflictingValue = attrNames.has(propName) && attrNames.has(attrName)

        twoWayBindings.push({
          elementName,
          propName,
          signalExpression: signalExpr,
          hasReadonly,
          hasDisabled,
          hasConflictingValue,
          line: pos.line,
          column: pos.column,
        })

        // Record conflicts
        if (hasConflictingValue) {
          bindingConflicts.push({
            type: 'conflict',
            propName,
            line: pos.line,
            column: pos.column,
          })
        }
        if (hasReadonly) {
          bindingConflicts.push({
            type: 'readonly',
            propName,
            line: pos.line,
            column: pos.column,
          })
        }
        if (hasDisabled) {
          bindingConflicts.push({
            type: 'disabled',
            propName,
            line: pos.line,
            column: pos.column,
          })
        }
        continue
      }

      // Check for reactive attributes
      if (
        attr.initializer &&
        ts.isJsxExpression(attr.initializer) &&
        attr.initializer.expression
      ) {
        const expr = attr.initializer.expression
        const isReactive = isReactiveExpression(expr)

        reactiveAttributes.push({
          elementName,
          attributeName: attrName,
          isReactive,
          line: pos.line,
          column: pos.column,
        })
      }
    }
  }

  function visit(node: ts.Node): void {
    visitModuleScope(node)

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      visitJsxElement(node)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return {
    reactiveAttributes,
    twoWayBindings,
    moduleScopeReactiveCalls,
    bindingConflicts,
  }
}
