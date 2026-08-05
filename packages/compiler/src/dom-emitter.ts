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

import ts from 'typescript';

// ---------------------------------------------------------------------------
// Reactive expression detection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Expression analysis helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `node` or any descendant contains a zero-arg call to a
 * simple identifier — the `sig()` pattern used to read Stewie signals.
 * Method calls and calls with arguments are excluded.
 */
function containsNoArgCall(node: ts.Node): boolean {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length === 0) return true;
  return ts.forEachChild(node, (c): true | undefined => (containsNoArgCall(c) ? true : undefined)) === true;
}

/**
 * Returns true if `node` or any descendant is a JSX element, self-closing
 * element, or fragment. Used to detect expressions that might return JSX nodes
 * (e.g. items.map(item => <li>{item}</li>)) that cannot safely be emitted as
 * a plain text node.
 */
function containsJsx(node: ts.Node): boolean {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return true;
  return ts.forEachChild(node, (c): true | undefined => (containsJsx(c) ? true : undefined)) === true;
}

/**
 * Value type flags that render as text (a text node is safe). Anything outside
 * this set — object types, JSX elements, DOM nodes, `any`/`unknown` — must NOT
 * be compiled into a text node.
 */
const TEXT_TYPE_FLAGS =
  ts.TypeFlags.StringLike |
  ts.TypeFlags.NumberLike |
  ts.TypeFlags.BooleanLike |
  ts.TypeFlags.BigIntLike |
  ts.TypeFlags.Null |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Void |
  ts.TypeFlags.EnumLike;

/**
 * Resolve the *value* a child expression produces. For an arrow/function
 * expression (`() => x`) this is the return type, not the function type, so
 * `() => count()` resolves to `number` and `() => makeFooter()` to `JSXElement`.
 */
function resolveChildValueType(expr: ts.Expression, checker: ts.TypeChecker): ts.Type {
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    if (ts.isArrowFunction(expr) && !ts.isBlock(expr.body)) {
      return checker.getTypeAtLocation(expr.body);
    }
    const sigs = checker.getTypeAtLocation(expr).getCallSignatures();
    if (sigs.length > 0) return sigs[0].getReturnType();
  }
  return checker.getTypeAtLocation(expr);
}

/** True when every constituent of `type` renders as text (no node/object arms). */
function isPrimitiveTextType(type: ts.Type, checker: ts.TypeChecker): boolean {
  const parts = type.isUnion() ? type.types : [type];
  return parts.every((p) => {
    const t = checker.getBaseConstraintOfType(p) ?? p;
    return (t.flags & TEXT_TYPE_FLAGS) !== 0;
  });
}

/**
 * Returns true if `expr` is provably a scalar (text-producing) value that is
 * safe to compile into a `document.createTextNode(String(...))` or reactive
 * text effect.
 *
 * Anything that is NOT provably scalar (e.g. a helper call returning JSX) might
 * be a DOM node at runtime, and must not be compiled into a text node — the
 * parent element should fall back to the JSX runtime so that `renderChildren`
 * can handle it structurally.
 *
 * The syntactic checks (literals, templates) are always safe. For everything
 * else — crucially, zero-arg calls like `count()` vs `makeFooter()`, which are
 * indistinguishable syntactically — a `TypeChecker` is required to verify the
 * produced value is primitive. Without a checker we conservatively return false
 * so a node-returning expression is never stringified (STW: `[object HTMLElement]`
 * bug). Literals/templates keep working; the fine-grained text optimization for
 * `{count()}` still applies whenever type info is available (always, under the
 * Vite plugin).
 */
function isProvenTextExpression(expr: ts.Expression, checker?: ts.TypeChecker): boolean {
  // String and number literals are definitely scalar
  if (ts.isStringLiteral(expr) || ts.isNumericLiteral(expr)) return true;
  // Template literals (with or without substitutions) produce strings
  if (ts.isNoSubstitutionTemplateLiteral(expr) || ts.isTemplateExpression(expr)) return true;
  // Everything else needs type info to prove it's text and not a node.
  if (!isReactive(expr)) return false;
  if (!checker) return false; // can't prove — fall back to the runtime path
  return isPrimitiveTextType(resolveChildValueType(expr, checker), checker);
}

/**
 * Returns true if `expr` is reactive — meaning it reads signal values and
 * should be wrapped in an effect() when used as an attribute or text child.
 *
 * Reactive patterns:
 * - Arrow/function expressions: `() => count()`
 * - Zero-arg calls: `count()` (direct signal read)
 * - Expressions that contain zero-arg calls: `count() + 1`, `items().length`
 */
function isReactive(expr: ts.Expression): boolean {
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return true;
  if (ts.isCallExpression(expr) && expr.arguments.length === 0) return true;
  if (containsNoArgCall(expr)) return true;
  return false;
}

/**
 * Return the source text of an expression suitable for use as a reactive value
 * inside an effect(). Arrow/function expressions are called as `(fn)()`. All
 * other expressions (zero-arg calls, complex expressions with embedded signal
 * reads) are returned as-is and evaluated inline inside the effect body.
 */
function asGetter(expr: ts.Expression, sourceFile: ts.SourceFile): string {
  const text = expr.getText(sourceFile);
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    return `(${text})()`;
  }
  return text; // zero-arg call or complex expression — evaluated inline
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
  rowspan: 'rowSpan'
};

function toDomProp(attrName: string): { prop: string; useSetAttribute: boolean } {
  if (PROP_MAP[attrName]) return { prop: PROP_MAP[attrName], useSetAttribute: false };
  // aria-*, data-*, custom attributes → setAttribute
  if (attrName.startsWith('aria-') || attrName.startsWith('data-') || attrName.includes('-')) {
    return { prop: attrName, useSetAttribute: true };
  }
  return { prop: attrName, useSetAttribute: false };
}

function isEventHandler(attrName: string): boolean {
  return attrName.length > 2 && /^on[A-Z]/.test(attrName);
}

function eventName(attrName: string): string {
  return attrName.slice(2).toLowerCase();
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
  checker?: ts.TypeChecker
): boolean {
  if (ts.isJsxText(node)) return true;
  if (ts.isJsxExpression(node)) {
    if (!node.expression) return true; // empty {} — safe, emits nothing
    // Reject if the expression contains JSX syntax (e.g. items.map(i => <li/>))
    if (containsJsx(node.expression)) return false;
    // Reject if the expression is not provably scalar. Opaque identifiers,
    // property accesses, and calls that might return JSX/DOM nodes at runtime
    // (e.g. a helper `makeFooter()`) must not be compiled to text nodes —
    // stringifying a node produces `[object HTMLElement]`.
    if (!isProvenTextExpression(node.expression, checker)) return false;
    return true;
  }

  if (ts.isJsxFragment(node)) {
    // Fragments at the top level — only transform if all children are native
    return Array.from(node.children).every((c) => canTransformJsx(c, sourceFile, checker));
  }

  const opening = ts.isJsxElement(node) ? node.openingElement : node; // self-closing
  if (!ts.isJsxOpeningElement(opening) && !ts.isJsxSelfClosingElement(opening)) return false;

  const tagName = opening.tagName.getText(sourceFile);
  if (!/^[a-z]/.test(tagName)) return false; // Component — cannot transform

  // Check for spread attributes or $prop attributes (handled by the $prop transformer)
  for (const attr of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attr)) return false;
    if (ts.isJsxAttribute(attr)) {
      const name = ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText(sourceFile);
      if (name.startsWith('$')) return false;
    }
  }

  // Recurse into children
  if (ts.isJsxElement(node)) {
    return Array.from(node.children).every((c) => canTransformJsx(c, sourceFile, checker));
  }

  return true;
}

// ---------------------------------------------------------------------------
// Code emitter
// ---------------------------------------------------------------------------

interface Counter {
  n: number;
}

interface EmitResult {
  /** Lines of setup code (variable declarations, effect() calls, appendChild calls). */
  lines: string[];
  /** The variable name that holds the root DOM element/node. */
  varName: string;
}

/**
 * Emit DOM setup code for a transformable JSX expression.
 * The caller wraps the result in an IIFE:
 *   `(() => { ...lines; return varName })()`
 */
export function emitJsxToDom(
  node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment,
  sourceFile: ts.SourceFile,
  counter: Counter
): EmitResult {
  if (ts.isJsxFragment(node)) {
    return emitFragment(Array.from(node.children), sourceFile, counter);
  }
  return emitElement(node, sourceFile, counter);
}

function emitFragment(children: ts.JsxChild[], sourceFile: ts.SourceFile, counter: Counter): EmitResult {
  const fragVar = `__frag${counter.n++}`;
  const lines: string[] = [`const ${fragVar} = document.createDocumentFragment()`];

  for (const child of children) {
    const childResult = emitChild(child, sourceFile, counter);
    if (childResult) {
      lines.push(...childResult.lines);
      lines.push(`${fragVar}.appendChild(${childResult.varName})`);
    }
  }
  return { lines, varName: fragVar };
}

function emitElement(node: ts.JsxElement | ts.JsxSelfClosingElement, sourceFile: ts.SourceFile, counter: Counter): EmitResult {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const tagName = opening.tagName.getText(sourceFile);
  const elVar = `__el${counter.n++}`;
  const lines: string[] = [];
  // ref callbacks are deferred until after all attributes and children are set
  const refLines: string[] = [];

  lines.push(`const ${elVar} = document.createElement(${JSON.stringify(tagName)})`);

  // Emit attributes
  for (const attr of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;

    const attrName = ts.isIdentifier(attr.name) ? attr.name.text : attr.name.getText(sourceFile);

    // key — framework hint, no DOM output
    if (attrName === 'key') continue;

    // ref — callback ref: ref={el => ...}  or  ref={myRef}
    // Deferred to after element setup so all attributes are set first.
    // Stored and emitted at the end of this function.
    if (attrName === 'ref') {
      if (attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
        const exprText = attr.initializer.expression.getText(sourceFile);
        // ref callback / ref object — emit after attributes
        refLines.push(
          ts.isArrowFunction(attr.initializer.expression) || ts.isFunctionExpression(attr.initializer.expression)
            ? `(${exprText})(${elVar})`
            : `(typeof ${exprText} === 'function' ? ${exprText}(${elVar}) : (${exprText}.current = ${elVar}))`
        );
      }
      continue;
    }

    if (!attr.initializer) {
      // Boolean attribute (e.g. `disabled`)
      lines.push(`${elVar}.setAttribute(${JSON.stringify(attrName)}, "")`);
      continue;
    }

    if (ts.isStringLiteral(attr.initializer)) {
      // Static string value
      const { prop, useSetAttribute } = toDomProp(attrName);
      if (useSetAttribute) {
        lines.push(`${elVar}.setAttribute(${JSON.stringify(attrName)}, ${JSON.stringify(attr.initializer.text)})`);
      } else {
        lines.push(`${elVar}.${prop} = ${JSON.stringify(attr.initializer.text)}`);
      }
      continue;
    }

    if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
      const expr = attr.initializer.expression;

      // Event handler
      if (isEventHandler(attrName)) {
        const evtName = eventName(attrName);
        const exprText = expr.getText(sourceFile);
        lines.push(`${elVar}.addEventListener(${JSON.stringify(evtName)}, ${exprText})`);
        continue;
      }

      // style — object or reactive object
      if (attrName === 'style') {
        if (isReactive(expr)) {
          const getter = asGetter(expr, sourceFile);
          lines.push(`effect(() => { Object.assign(${elVar}.style, ${getter}) })`);
        } else {
          const exprText = expr.getText(sourceFile);
          lines.push(`Object.assign(${elVar}.style, ${exprText})`);
        }
        continue;
      }

      const { prop, useSetAttribute } = toDomProp(attrName);

      if (isReactive(expr)) {
        const getter = asGetter(expr, sourceFile);
        if (useSetAttribute) {
          lines.push(`effect(() => { ${elVar}.setAttribute(${JSON.stringify(attrName)}, String(${getter})) })`);
        } else {
          lines.push(`effect(() => { ${elVar}.${prop} = ${getter} })`);
        }
      } else {
        // Static expression
        const exprText = expr.getText(sourceFile);
        if (useSetAttribute) {
          lines.push(`${elVar}.setAttribute(${JSON.stringify(attrName)}, String(${exprText}))`);
        } else {
          lines.push(`${elVar}.${prop} = ${exprText}`);
        }
      }
    }
  }

  // Emit children
  const children = ts.isJsxElement(node) ? Array.from(node.children) : [];
  for (const child of children) {
    const childResult = emitChild(child, sourceFile, counter);
    if (childResult) {
      lines.push(...childResult.lines);
      lines.push(`${elVar}.appendChild(${childResult.varName})`);
    }
  }

  // Emit ref callbacks after element is fully set up
  if (refLines.length > 0) {
    lines.push(...refLines);
  }

  return { lines, varName: elVar };
}

function emitChild(child: ts.JsxChild, sourceFile: ts.SourceFile, counter: Counter): EmitResult | null {
  // Text node
  if (ts.isJsxText(child)) {
    const text = child.text;
    // Trim whitespace-only text between elements
    const trimmed = text.trim();
    if (!trimmed) return null;
    const tVar = `__t${counter.n++}`;
    return {
      lines: [`const ${tVar} = document.createTextNode(${JSON.stringify(trimmed)})`],
      varName: tVar
    };
  }

  // Expression child: {expr}
  if (ts.isJsxExpression(child)) {
    if (!child.expression) return null;

    const expr = child.expression;

    if (isReactive(expr)) {
      const tVar = `__t${counter.n++}`;
      const getter = asGetter(expr, sourceFile);
      return {
        lines: [`const ${tVar} = document.createTextNode('')`, `effect(() => { ${tVar}.nodeValue = String(${getter}) })`],
        varName: tVar
      };
    }

    // Static expression — create text node once
    const tVar = `__t${counter.n++}`;
    const exprText = expr.getText(sourceFile);
    return {
      lines: [`const ${tVar} = document.createTextNode(String(${exprText}))`],
      varName: tVar
    };
  }

  // Nested JSX element (only native elements reach here — ensured by canTransformJsx)
  if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
    return emitElement(child, sourceFile, counter);
  }

  if (ts.isJsxFragment(child)) {
    return emitFragment(Array.from(child.children), sourceFile, counter);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Top-level: find and replace JSX expressions in source
// ---------------------------------------------------------------------------

export interface JsxReplacement {
  /** Character offset start in the original source. */
  start: number;
  /** Character offset end (exclusive). */
  end: number;
  /** Replacement IIFE code. */
  replacement: string;
}

/**
 * Walk the parsed source file and find JSX expressions that can be
 * transformed to direct DOM code. Returns replacements sorted in
 * reverse source order (so applying them doesn't shift earlier offsets).
 */
/**
 * Returns true if a JSX node sits inside another JSX subtree at any depth,
 * even when wrapped in transparent expression constructs (parens, ternary,
 * `||`/`??`, `as` cast, non-null assertion). The previous check only looked
 * one level up the AST, so:
 *
 *     <div>{cond ? <span/> : <p/>}</div>
 *     <div>{user.bio || <span/>}</div>
 *
 * both got their inner JSX flagged as "top-level" and rewritten to
 * imperative `document.createElement` IIFEs, producing JSX/JS hybrid output
 * that the JSX parser can no longer parse. Walking through transparent
 * expressions until we find either a JSX parent (= still inside JSX) or
 * something opaque (= genuine top-level) closes that gap.
 */
function isInsideJsxContext(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxElement(current) || ts.isJsxFragment(current)) return true;
    if (ts.isJsxExpression(current)) {
      const grand = current.parent;
      return ts.isJsxElement(grand) || ts.isJsxFragment(grand);
    }
    // Keep walking through expression constructs that don't break JSX context.
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isConditionalExpression(current) ||
      ts.isBinaryExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
      current = current.parent;
      continue;
    }
    return false;
  }
  return false;
}

export function findJsxReplacements(sourceFile: ts.SourceFile, checker?: ts.TypeChecker): JsxReplacement[] {
  const replacements: JsxReplacement[] = [];
  const counter: Counter = { n: 0 };

  /**
   * @param insideReactiveFn - true when we are inside an arrow/function
   * expression that is a JSX expression child (i.e. a render-prop passed to
   * <For>, <Show>, etc.). JSX inside such functions must NOT be transformed
   * to IIFEs because the resulting DOM nodes would bypass the hydration cursor
   * — the hydration system would never claim the server-rendered nodes and
   * fresh client nodes would be inserted alongside them (duplication).
   */
  function visit(node: ts.Node, insideReactiveFn = false): void {
    // Only transform JSX elements that are NOT inside another JSX element and
    // NOT inside a render-prop function passed as a JSX expression child.
    //
    // Safe patterns (parent is JS, not JSX, not inside a reactive fn):
    //   return <div>...</div>          parent = ReturnStatement
    //   const el = <div>...</div>      parent = VariableDeclaration
    //
    // Skipped patterns:
    //   <div>{<span/>}</div>           grandparent is JSX (insideJsx)
    //   <For>{item => <div/>}</For>    inside a render-prop (insideReactiveFn)
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      if (!isInsideJsxContext(node) && !insideReactiveFn && canTransformJsx(node, sourceFile, checker)) {
        const result = emitJsxToDom(node as ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment, sourceFile, counter);

        const setupCode = result.lines.join('\n    ');
        const iife = `(() => {\n    ${setupCode}\n    return ${result.varName}\n  })()`;

        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: iife
        });

        // Don't recurse into children — we've already emitted them inline
        return;
      }
    }

    // When entering a function whose parent is a JsxExpression inside JSX
    // (i.e. a render-prop: <For>{item => <div/>}</For>), mark insideReactiveFn
    // so any JSX inside it is left untransformed and handled by the JSX runtime.
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const parent = node.parent;
      if (ts.isJsxExpression(parent) && (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent))) {
        ts.forEachChild(node, (child) => visit(child, true));
        return;
      }
    }

    ts.forEachChild(node, (child) => visit(child, insideReactiveFn));
  }

  visit(sourceFile);

  // Sort in reverse order so replacements don't shift each other's offsets
  replacements.sort((a, b) => b.start - a.start);
  return replacements;
}
