// analyzer.ts — walk the AST and identify reactive patterns

import ts from 'typescript';
import type { ParsedFile } from './parser.js';

export interface ReactiveAttribute {
  elementName: string;
  attributeName: string;
  isReactive: boolean;
  line: number;
  column: number;
}

export interface TwoWayBinding {
  elementName: string;
  propName: string; // e.g. 'value' from '$value'
  signalExpression: string; // the expression passed to $value={...}
  hasReadonly: boolean;
  hasDisabled: boolean;
  hasConflictingValue: boolean; // has both $value and value
  line: number;
  column: number;
}

export interface ModuleScopeCall {
  callee: string; // 'signal' | 'store' | 'computed' | 'effect'
  line: number;
  column: number;
}

export interface BindingConflict {
  type: 'conflict' | 'readonly' | 'disabled';
  propName: string;
  line: number;
  column: number;
}

export interface AutoWrapCandidate {
  /** Character offset of the opening `{` in the source */
  start: number;
  /** Character offset just past the closing `}` */
  end: number;
  /** Expression text without the surrounding braces */
  expressionText: string;
}

export interface AnalysisResult {
  reactiveAttributes: ReactiveAttribute[];
  twoWayBindings: TwoWayBinding[];
  moduleScopeReactiveCalls: ModuleScopeCall[];
  bindingConflicts: BindingConflict[];
  autoWrapCandidates: AutoWrapCandidate[];
}

const REACTIVE_CALLEES = new Set(['signal', 'store', 'computed', 'effect']);

/**
 * Syntax-only heuristic (no type info): returns true if `node` or any
 * descendant contains a no-arg call to a plain identifier — the `sig()`
 * pattern that reads a Stewie signal. This over-wraps `{row().id}` when
 * `row` is a plain `() => Row` getter, but is always safe (wrong wraps add
 * an unnecessary effect but never break reactivity). Used as a fallback when
 * no TypeChecker is available (plain JS, file not in program, etc.).
 */
function containsNoArgIdentifierCall(node: ts.Node): boolean {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length === 0) {
    return true;
  }
  return (
    ts.forEachChild(node, (child): true | undefined =>
      containsNoArgIdentifierCall(child) ? true : undefined
    ) === true
  );
}

/**
 * Returns true if `type` is a Stewie Signal<T> or Computed<T>.
 * Both are callable and expose a `.peek()` method — that pair is the
 * distinguishing characteristic vs a plain `() => T` arrow function.
 */
function isSignalType(type: ts.Type): boolean {
  return type.getCallSignatures().length > 0 && type.getProperty('peek') !== undefined;
}

/**
 * Type-aware reactive read detector. Returns true if `node` or any descendant
 * calls a value whose type is Signal<T> or Computed<T>.
 *
 * Handles the three real patterns:
 *   count()           — callee `count: Signal<number>` → true
 *   count() + 1       — binary expr containing count() → true
 *   row().id          — callee `row: () => Row` (no peek) → false ✓
 *   row().label()     — callee of outer call is `row().label: Signal<string>` → true ✓
 */
function containsSignalRead(node: ts.Node, checker: ts.TypeChecker): boolean {
  if (ts.isCallExpression(node) && node.arguments.length === 0) {
    // Check whether the thing being called has a Signal/Computed type.
    const calleeType = checker.getTypeAtLocation(node.expression);
    if (isSignalType(calleeType)) return true;
    // Callee is not a signal itself — recurse in case there are signal reads
    // deeper in the expression (e.g. row().label() where label: Signal<string>).
  }
  return (
    ts.forEachChild(node, (child): true | undefined =>
      containsSignalRead(child, checker) ? true : undefined
    ) === true
  );
}

function isIntrinsicElement(name: string): boolean {
  return /^[a-z]/.test(name);
}

function getLineAndColumn(node: ts.Node, sourceFile: ts.SourceFile): { line: number; column: number } {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: line + 1, column: character + 1 };
}

function isReactiveExpression(expr: ts.Expression): boolean {
  // Arrow function or function expression => reactive
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    return true;
  }
  // Call expression with no args => likely a signal read (e.g. mySignal())
  if (ts.isCallExpression(expr) && expr.arguments.length === 0) {
    return true;
  }
  return false;
}

function getJsxElementName(node: ts.JsxOpeningLikeElement): string {
  const tagName = node.tagName;
  return tagName.getText();
}

export function analyzeFile(parsed: ParsedFile, checker?: ts.TypeChecker): AnalysisResult {
  const { sourceFile } = parsed;

  const reactiveAttributes: ReactiveAttribute[] = [];
  const twoWayBindings: TwoWayBinding[] = [];
  const moduleScopeReactiveCalls: ModuleScopeCall[] = [];
  const bindingConflicts: BindingConflict[] = [];
  const autoWrapCandidates: AutoWrapCandidate[] = [];

  function visitModuleScope(node: ts.Node): void {
    // Check for reactive calls at module scope
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && REACTIVE_CALLEES.has(node.expression.text)) {
      // Walk up to find the statement, which should be a direct child of SourceFile
      let current: ts.Node = node;
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
          return;
        }
        current = current.parent;
      }

      // current.parent === sourceFile => top-level statement
      if (current.parent === sourceFile) {
        const pos = getLineAndColumn(node, sourceFile);
        moduleScopeReactiveCalls.push({
          callee: (node.expression as ts.Identifier).text,
          line: pos.line,
          column: pos.column
        });
      }
    }
  }

  function visitJsxChildren(node: ts.JsxElement): void {
    const tagName = node.openingElement.tagName.getText();
    if (!isIntrinsicElement(tagName)) return;

    for (const child of node.children) {
      if (!ts.isJsxExpression(child) || !child.expression) continue;
      const expr = child.expression;
      if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) continue;
      const hasReactiveRead = checker
        ? containsSignalRead(expr, checker)
        : containsNoArgIdentifierCall(expr);
      if (!hasReactiveRead) continue;

      autoWrapCandidates.push({
        start: child.getStart(sourceFile),
        end: child.getEnd(),
        expressionText: expr.getText(sourceFile)
      });
    }
  }

  function visitJsxElement(node: ts.JsxOpeningLikeElement): void {
    const elementName = getJsxElementName(node);
    const isIntrinsic = isIntrinsicElement(elementName);
    const attrs = node.attributes.properties;

    // Collect all attribute names for conflict detection
    const attrNames = new Map<string, ts.JsxAttribute>();
    for (const attr of attrs) {
      if (ts.isJsxAttribute(attr) && ts.isIdentifier(attr.name)) {
        attrNames.set(attr.name.text, attr);
      }
    }

    for (const attr of attrs) {
      if (!ts.isJsxAttribute(attr)) continue;
      if (!ts.isIdentifier(attr.name)) continue;

      const attrName = attr.name.text;
      const pos = getLineAndColumn(attr, sourceFile);

      // Check for $prop two-way bindings
      if (attrName.startsWith('$')) {
        const propName = attrName.slice(1); // strip '$'

        let signalExpr = '';
        if (attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
          signalExpr = attr.initializer.expression.getText(sourceFile);
        }

        const hasReadonly = attrNames.has('readonly') || attrNames.has('readOnly');
        const hasDisabled = attrNames.has('disabled');
        const hasConflictingValue = attrNames.has(propName) && attrNames.has(attrName);

        twoWayBindings.push({
          elementName,
          propName,
          signalExpression: signalExpr,
          hasReadonly,
          hasDisabled,
          hasConflictingValue,
          line: pos.line,
          column: pos.column
        });

        // Record conflicts
        if (hasConflictingValue) {
          bindingConflicts.push({
            type: 'conflict',
            propName,
            line: pos.line,
            column: pos.column
          });
        }
        if (hasReadonly) {
          bindingConflicts.push({
            type: 'readonly',
            propName,
            line: pos.line,
            column: pos.column
          });
        }
        if (hasDisabled) {
          bindingConflicts.push({
            type: 'disabled',
            propName,
            line: pos.line,
            column: pos.column
          });
        }
        continue;
      }

      // Check for reactive attributes
      if (attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
        const expr = attr.initializer.expression;
        const isReactive = isReactiveExpression(expr);

        reactiveAttributes.push({
          elementName,
          attributeName: attrName,
          isReactive,
          line: pos.line,
          column: pos.column
        });

        // Auto-wrap: if this is an intrinsic element, the attribute is not an
        // event handler, the expression is not already a function, but it
        // contains a no-arg identifier call (signal read pattern) → wrap in () =>
        const attrHasReactiveRead = checker
          ? containsSignalRead(expr, checker)
          : containsNoArgIdentifierCall(expr);
        if (isIntrinsic && !attrName.startsWith('on') && !isReactive && attrHasReactiveRead) {
          autoWrapCandidates.push({
            start: attr.initializer.getStart(sourceFile),
            end: attr.initializer.getEnd(),
            expressionText: expr.getText(sourceFile)
          });
        }
      }
    }
  }

  function visit(node: ts.Node): void {
    visitModuleScope(node);

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      visitJsxElement(node);
    }

    if (ts.isJsxElement(node)) {
      visitJsxChildren(node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    reactiveAttributes,
    twoWayBindings,
    moduleScopeReactiveCalls,
    bindingConflicts,
    autoWrapCandidates
  };
}
