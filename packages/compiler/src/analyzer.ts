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

export interface NestedReactiveCall {
  // The rule we tripped. STW040 = signal() inside effect() body.
  // STW042 = effect() inside computed() body.
  code: 'STW040' | 'STW042';
  // The inner callee that triggered the rule (e.g. 'signal' for STW040).
  callee: string;
  line: number;
  column: number;
}

export interface NonModuleScopeCreateContext {
  line: number;
  column: number;
}

export interface PeekInReactiveContext {
  line: number;
  column: number;
  // Stack kind at the point of detection ('effect' or 'computed').
  scope: 'effect' | 'computed';
}

export interface ForByConstantKey {
  line: number;
  column: number;
  // The offending expression text (e.g. "() => 'x'", "(_) => _").
  pattern: string;
}

export interface ExternalLinkTo {
  line: number;
  column: number;
  url: string;
}

export interface ModuleScopeBrowserGlobal {
  name: 'window' | 'document';
  line: number;
  column: number;
}

export interface UncalledSignalInJsx {
  // STW010 for JSX text children, STW011 for attribute values.
  code: 'STW010' | 'STW011';
  // For STW011, the attribute/element names.
  attribute?: string;
  element?: string;
  line: number;
  column: number;
}

export interface EagerControlFlowRead {
  // STW020 = Show `when`, STW021 = For `each`.
  code: 'STW020' | 'STW021';
  element: 'Show' | 'For';
  attribute: 'when' | 'each';
  line: number;
  column: number;
}

export interface TwoWayTargetIssue {
  // STW090 = target is not a signal at all (not callable);
  // STW091 = target is callable but read-only (no .set — computed/accessor).
  code: 'STW090' | 'STW091';
  propName: string; // e.g. 'value' from '$value'
  line: number;
  column: number;
}

export interface AnalysisResult {
  reactiveAttributes: ReactiveAttribute[];
  twoWayBindings: TwoWayBinding[];
  moduleScopeReactiveCalls: ModuleScopeCall[];
  bindingConflicts: BindingConflict[];
  autoWrapCandidates: AutoWrapCandidate[];
  nestedReactiveCalls: NestedReactiveCall[];
  nonModuleScopeCreateContext: NonModuleScopeCreateContext[];
  peekInReactiveContext: PeekInReactiveContext[];
  forByConstantKeys: ForByConstantKey[];
  externalLinkTos: ExternalLinkTo[];
  moduleScopeBrowserGlobals: ModuleScopeBrowserGlobal[];
  uncalledSignalsInJsx: UncalledSignalInJsx[];
  eagerControlFlowReads: EagerControlFlowRead[];
  twoWayTargetIssues: TwoWayTargetIssue[];
}

// Callees whose call at module scope creates per-call-site signals and is
// therefore unsafe (leaks state across SSR requests). Each maps to its own
// STW code via MODULE_SCOPE_CODES in the validator. `useAction` is included
// because it instantiates pending/error signals; `defineAction` is NOT —
// definitions create no signals and are encouraged at module scope.
const REACTIVE_CALLEES = new Set(['signal', 'store', 'computed', 'effect', 'useAction', 'useResource', 'useTitle', 'useMeta']);

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
  return ts.forEachChild(node, (child): true | undefined => (containsNoArgIdentifierCall(child) ? true : undefined)) === true;
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
 * Returns true if `type` is a plain zero-arg accessor (`() => T`) that is
 * *not* a Stewie signal. These are the "accessor props" Stewie components
 * accept when the parent wants reactivity without handing over the signal.
 */
function isPlainAccessorType(type: ts.Type): boolean {
  const sigs = type.getCallSignatures();
  if (sigs.length === 0) return false;
  if (type.getProperty('peek') !== undefined) return false; // it's a signal
  // Must be zero-arg to count as an accessor shape.
  return sigs.some((s) => s.parameters.length === 0);
}

/**
 * Type-aware reactive read detector. Returns true if `node` or any descendant
 * calls a value whose type is Signal<T>, Computed<T>, or a plain accessor
 * (`() => T`, no `.peek`). Both shapes need to be wrapped in JSX positions so
 * the read participates in the surrounding reactive effect.
 *
 *   count()           — callee `count: Signal<number>` → true
 *   row().label()     — outer callee `Signal<string>` → true
 *   row().id          — callee `row: () => Row` accessor → true (NEW)
 *   plain.value       — no zero-arg calls → false
 *
 * The accessor branch generalizes the autowrap to keyed-list children
 * (`<For>{(item) => <div>{item().name}</div>}`) and any component prop
 * typed `() => T`. STW030 used to flag these as static reads; with autowrap
 * doing the work the diagnostic is obsolete.
 */
function containsReactiveRead(node: ts.Node, checker: ts.TypeChecker): boolean {
  if (ts.isCallExpression(node) && node.arguments.length === 0) {
    const calleeType = checker.getTypeAtLocation(node.expression);
    if (isSignalType(calleeType)) return true;
    if (isPlainAccessorType(calleeType)) return true;
  }
  return ts.forEachChild(node, (child): true | undefined => (containsReactiveRead(child, checker) ? true : undefined)) === true;
}

/**
 * Like `containsReactiveRead`, but matches *only* genuine Signal<T>/Computed<T>
 * reads — not plain `() => T` accessors. Used for error-severity diagnostics
 * (STW020/STW021) where flagging an ambiguous accessor call would be a false
 * positive: `when={helper()}` for a static helper is type-identical to
 * `when={sig()}`, so we only flag the unambiguous signal case.
 */
function containsSignalRead(node: ts.Node, checker: ts.TypeChecker): boolean {
  if (ts.isCallExpression(node) && node.arguments.length === 0) {
    if (isSignalType(checker.getTypeAtLocation(node.expression))) return true;
  }
  return ts.forEachChild(node, (child): true | undefined => (containsSignalRead(child, checker) ? true : undefined)) === true;
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
  const nestedReactiveCalls: NestedReactiveCall[] = [];
  const nonModuleScopeCreateContext: NonModuleScopeCreateContext[] = [];
  const peekInReactiveContext: PeekInReactiveContext[] = [];
  const forByConstantKeys: ForByConstantKey[] = [];
  const externalLinkTos: ExternalLinkTo[] = [];
  const moduleScopeBrowserGlobals: ModuleScopeBrowserGlobal[] = [];
  const uncalledSignalsInJsx: UncalledSignalInJsx[] = [];
  const eagerControlFlowReads: EagerControlFlowRead[] = [];
  const twoWayTargetIssues: TwoWayTargetIssue[] = [];

  // Stack of currently-active reactive bodies. Pushed when we descend into
  // the function argument of an effect()/computed() call; popped on exit.
  // Used by STW040 (signal() inside effect) and STW042 (effect() inside computed).
  const reactiveBodyStack: ('effect' | 'computed')[] = [];

  function isModuleScopeCall(node: ts.Node): boolean {
    let current: ts.Node = node;
    while (current.parent && current.parent !== sourceFile) {
      if (
        ts.isFunctionDeclaration(current.parent) ||
        ts.isFunctionExpression(current.parent) ||
        ts.isArrowFunction(current.parent) ||
        ts.isMethodDeclaration(current.parent) ||
        ts.isClassDeclaration(current.parent) ||
        ts.isClassExpression(current.parent) ||
        ts.isBlock(current.parent)
      ) {
        return false;
      }
      current = current.parent;
    }
    return current.parent === sourceFile;
  }

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

      // STW010: bare Signal<T> / Computed<T> identifier as a JSX text child.
      if (checker && ts.isIdentifier(expr)) {
        const type = checker.getTypeAtLocation(expr);
        if (isSignalType(type)) {
          const pos = getLineAndColumn(expr, sourceFile);
          uncalledSignalsInJsx.push({ code: 'STW010', line: pos.line, column: pos.column });
          continue;
        }
      }

      const hasReactiveRead = checker ? containsReactiveRead(expr, checker) : containsNoArgIdentifierCall(expr);
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

    // STW022 / STW073: component-specific attribute checks
    if (elementName === 'For') {
      const byAttr = attrs.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && ts.isIdentifier(a.name) && a.name.text === 'by');
      if (byAttr && byAttr.initializer && ts.isJsxExpression(byAttr.initializer) && byAttr.initializer.expression) {
        const expr = byAttr.initializer.expression;
        if (ts.isArrowFunction(expr)) {
          const body = expr.body;
          // () => 'x' / () => 42 / () => null / () => true — literal return
          const isLiteralBody =
            ts.isStringLiteral(body) ||
            ts.isNumericLiteral(body) ||
            body.kind === ts.SyntaxKind.TrueKeyword ||
            body.kind === ts.SyntaxKind.FalseKeyword ||
            body.kind === ts.SyntaxKind.NullKeyword;
          // (x) => x — identity returns a param directly
          let isIdentityBody = false;
          if (ts.isIdentifier(body) && expr.parameters.length > 0) {
            const paramNames = expr.parameters
              .map((p) => (ts.isIdentifier(p.name) ? p.name.text : null))
              .filter((n): n is string => n !== null);
            if (paramNames.includes(body.text)) isIdentityBody = true;
          }
          if (isLiteralBody || isIdentityBody) {
            const pos = getLineAndColumn(byAttr, sourceFile);
            forByConstantKeys.push({
              line: pos.line,
              column: pos.column,
              pattern: expr.getText(sourceFile)
            });
          }
        }
      }
    }

    // STW020 / STW021: <Show when={sig()}> / <For each={sig()}> — an eager
    // signal read passed as the value. The read is captured once at mount, so
    // the control flow never re-evaluates. Pass the signal directly or wrap in
    // () =>. Restricted to genuine Signal/Computed reads (not plain accessors)
    // so a static helper call isn't a false positive. Type-aware only.
    if (checker && (elementName === 'Show' || elementName === 'For')) {
      const cfProp = elementName === 'Show' ? 'when' : 'each';
      const cfAttr = attrs.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && ts.isIdentifier(a.name) && a.name.text === cfProp);
      if (cfAttr?.initializer && ts.isJsxExpression(cfAttr.initializer) && cfAttr.initializer.expression) {
        const expr = cfAttr.initializer.expression;
        const isFn = ts.isArrowFunction(expr) || ts.isFunctionExpression(expr);
        if (!isFn && containsSignalRead(expr, checker)) {
          const pos = getLineAndColumn(cfAttr, sourceFile);
          eagerControlFlowReads.push({
            code: elementName === 'Show' ? 'STW020' : 'STW021',
            element: elementName,
            attribute: cfProp,
            line: pos.line,
            column: pos.column
          });
        }
      }
    }

    if (elementName === 'Link') {
      const toAttr = attrs.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && ts.isIdentifier(a.name) && a.name.text === 'to');
      if (toAttr && toAttr.initializer) {
        let urlText: string | null = null;
        if (ts.isStringLiteral(toAttr.initializer)) {
          urlText = toAttr.initializer.text;
        } else if (ts.isJsxExpression(toAttr.initializer) && toAttr.initializer.expression) {
          const expr = toAttr.initializer.expression;
          if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
            urlText = expr.text;
          }
        }
        if (urlText && /^(https?:\/\/|\/\/)/.test(urlText)) {
          const pos = getLineAndColumn(toAttr, sourceFile);
          externalLinkTos.push({
            line: pos.line,
            column: pos.column,
            url: urlText
          });
        }
      }
    }

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

          // STW090 / STW091: the $prop target must be a writable signal (has
          // `.set`). The compiler emits `expr.set(...)`, so a non-signal target
          // fails at runtime. A callable-but-not-writable target (a computed or
          // a plain `() => T` accessor) is read-only. Skip any/unknown to avoid
          // false positives on untyped code. Type-aware only.
          if (checker) {
            const targetType = checker.getTypeAtLocation(attr.initializer.expression);
            const isAnyOrUnknown = (targetType.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0;
            if (!isAnyOrUnknown) {
              const writable = targetType.getProperty('set') !== undefined;
              if (!writable) {
                const callable = targetType.getCallSignatures().length > 0;
                twoWayTargetIssues.push({
                  code: callable ? 'STW091' : 'STW090',
                  propName,
                  line: pos.line,
                  column: pos.column
                });
              }
            }
          }
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

        // STW011: bare Signal<T> / Computed<T> identifier passed as the value
        // of an attribute on an intrinsic element. Skipped for event handlers
        // (`on*`) and for component attributes (those may accept signals
        // intentionally).
        if (isIntrinsic && !attrName.startsWith('on') && checker && ts.isIdentifier(expr)) {
          const type = checker.getTypeAtLocation(expr);
          if (isSignalType(type)) {
            uncalledSignalsInJsx.push({
              code: 'STW011',
              element: elementName,
              attribute: attrName,
              line: pos.line,
              column: pos.column
            });
          }
        }

        // Auto-wrap: if this is an intrinsic element, the attribute is not an
        // event handler, the expression is not already a function, but it
        // contains a no-arg identifier call (signal read pattern) → wrap in () =>
        const attrHasReactiveRead = checker ? containsReactiveRead(expr, checker) : containsNoArgIdentifierCall(expr);
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

    // Nested reactive call detection + createContext placement check.
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const callee = node.expression.text;
      const top = reactiveBodyStack[reactiveBodyStack.length - 1];

      if (callee === 'signal' && top === 'effect') {
        const pos = getLineAndColumn(node, sourceFile);
        nestedReactiveCalls.push({ code: 'STW040', callee, line: pos.line, column: pos.column });
      } else if (callee === 'effect' && top === 'computed') {
        const pos = getLineAndColumn(node, sourceFile);
        nestedReactiveCalls.push({ code: 'STW042', callee, line: pos.line, column: pos.column });
      }

      if (callee === 'createContext' && !isModuleScopeCall(node)) {
        const pos = getLineAndColumn(node, sourceFile);
        nonModuleScopeCreateContext.push({ line: pos.line, column: pos.column });
      }
    }

    // STW014: sig.peek() inside an effect() or computed() body
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 0 &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.name) &&
      node.expression.name.text === 'peek' &&
      reactiveBodyStack.length > 0
    ) {
      const pos = getLineAndColumn(node, sourceFile);
      peekInReactiveContext.push({
        line: pos.line,
        column: pos.column,
        scope: reactiveBodyStack[reactiveBodyStack.length - 1]!
      });
    }

    // STW083: window.X / document.X at module scope. Narrowed to
    // PropertyAccessExpression on window/document (e.g. `window.location`,
    // `document.title`) to avoid false positives on property keys and
    // shadowed names. Module-scope check walks up to the first enclosing
    // function boundary.
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'window' || node.expression.text === 'document') &&
      isModuleScopeCall(node)
    ) {
      const pos = getLineAndColumn(node.expression, sourceFile);
      moduleScopeBrowserGlobals.push({
        name: node.expression.text,
        line: pos.line,
        column: pos.column
      });
    }

    // Push a reactive-body frame when descending into effect(fn) / computed(fn).
    // Only push for inline function arguments — if the callback is an
    // identifier reference, we can't reliably know what's inside, so skip.
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if ((name === 'effect' || name === 'computed') && node.arguments.length >= 1) {
        const arg = node.arguments[0];
        if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
          reactiveBodyStack.push(name);
          ts.forEachChild(node, visit);
          reactiveBodyStack.pop();
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    reactiveAttributes,
    twoWayBindings,
    moduleScopeReactiveCalls,
    bindingConflicts,
    autoWrapCandidates,
    nestedReactiveCalls,
    nonModuleScopeCreateContext,
    peekInReactiveContext,
    forByConstantKeys,
    externalLinkTos,
    moduleScopeBrowserGlobals,
    uncalledSignalsInJsx,
    eagerControlFlowReads,
    twoWayTargetIssues
  };
}
