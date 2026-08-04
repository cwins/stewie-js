// validator.ts — emit diagnostics based on analysis results

import { diagnosticDocsUrl } from '@stewie-js/core';
import type { ParsedFile } from './parser.js';
import type { AnalysisResult } from './analyzer.js';
import type { CompilerDiagnostic } from './types.js';

// Module-scope reactive primitive → diagnostic code. Each callee gets its
// own STW code so the message can name the actual function and users can
// link to a per-rule docs page. See DIAGNOSTICS.md phase 1.
const MODULE_SCOPE_CODES: Record<string, string> = {
  signal: 'STW001',
  computed: 'STW002',
  store: 'STW003',
  effect: 'STW004',
  useAction: 'STW005',
  useResource: 'STW006',
  useTitle: 'STW007',
  useMeta: 'STW007'
};

function moduleScopeMessage(callee: string): string {
  if (callee === 'effect') {
    return `effect() called at module scope. Effects must be owned by a component or reactiveScope() so they can be disposed.`;
  }
  if (callee === 'useAction') {
    return `useAction() called at module scope. The instance creates per-call-site pending/error signals that must be owned by a scope so they can be disposed; calling it at module scope leaks state across SSR requests. Move the useAction() call inside a component body or reactiveScope(). (defineAction() at module scope is fine — it creates no signals.)`;
  }
  if (callee === 'useResource') {
    return `useResource() called at module scope. The instance creates per-call-site data/loading/error signals that must be owned by a scope so they can be disposed; calling it at module scope leaks state across SSR requests. Move the useResource() call inside a component body or reactiveScope(). (defineResource() at module scope is fine — it creates no signals.)`;
  }
  if (callee === 'useTitle' || callee === 'useMeta') {
    return `${callee}() called at module scope. Head primitives create reactive effects that must be owned by a scope so they are disposed on unmount; calling at module scope attaches a persistent document.head write effect that leaks across SSR requests. Move the ${callee}() call inside a component body or reactiveScope().`;
  }
  return `${callee}() called at module scope. Reactive primitives must be created inside a component or reactiveScope() — module-scope ${callee}s leak state across SSR requests.`;
}

export function validateFile(_parsed: ParsedFile, analysis: AnalysisResult): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];

  // STW001–004: reactive primitive called at module scope
  for (const call of analysis.moduleScopeReactiveCalls) {
    const code = MODULE_SCOPE_CODES[call.callee];
    if (!code) continue;
    diagnostics.push({
      code,
      severity: 'error',
      message: moduleScopeMessage(call.callee),
      line: call.line,
      column: call.column,
      docsUrl: diagnosticDocsUrl(code)
    });
  }

  // STW040: signal() inside effect() body
  // STW042: effect() inside computed() body
  for (const nested of analysis.nestedReactiveCalls) {
    const message =
      nested.code === 'STW040'
        ? `signal() called inside an effect() body. This creates a new signal on every effect run, so the signal's state resets each time and nothing outside the effect can read it. Hoist the signal() call outside the effect.`
        : `effect() called inside a computed() body. Computeds must be pure; effects created here will not be cleaned up and can loop when the computed re-evaluates. Move the effect to a component body or reactiveScope().`;
    diagnostics.push({
      code: nested.code,
      severity: 'error',
      message,
      line: nested.line,
      column: nested.column,
      docsUrl: diagnosticDocsUrl(nested.code)
    });
  }

  // STW052: createContext() called outside module scope
  for (const call of analysis.nonModuleScopeCreateContext) {
    diagnostics.push({
      code: 'STW052',
      severity: 'warning',
      message: `createContext() called outside module scope. Each call creates a new context identity, so provide()/consume() pairs in different renders will never match. Move createContext() to the top level of the module.`,
      line: call.line,
      column: call.column,
      docsUrl: diagnosticDocsUrl('STW052')
    });
  }

  // STW014: signal.peek() inside a reactive context
  for (const peek of analysis.peekInReactiveContext) {
    diagnostics.push({
      code: 'STW014',
      severity: 'warning',
      message: `peek() called inside a ${peek.scope}() body. peek() reads without subscribing, so the ${peek.scope} will not re-run when the signal changes. Call the signal directly ('sig()') if you want reactivity, or move the peek() out of the reactive context.`,
      line: peek.line,
      column: peek.column,
      docsUrl: diagnosticDocsUrl('STW014')
    });
  }

  // STW022: <For by> returns a constant or the identity of its parameter
  for (const by of analysis.forByConstantKeys) {
    diagnostics.push({
      code: 'STW022',
      severity: 'warning',
      message: `<For by> key function '${by.pattern}' returns a value that is not per-item unique. Keys must be unique for keyed reconciliation; a constant or identity return will cause items to collapse or re-render incorrectly. Return a unique identifier per item (e.g., 'by={(item) => item.id}').`,
      line: by.line,
      column: by.column,
      docsUrl: diagnosticDocsUrl('STW022')
    });
  }

  // STW073: <Link to> looks like an external URL
  for (const link of analysis.externalLinkTos) {
    diagnostics.push({
      code: 'STW073',
      severity: 'warning',
      message: `<Link to='${link.url}'> appears to be an external URL. <Link> is for internal client-side navigation only; external links should use a plain <a href='${link.url}' rel='noopener noreferrer'>.`,
      line: link.line,
      column: link.column,
      docsUrl: diagnosticDocsUrl('STW073')
    });
  }

  // STW083: window / document accessed at module scope
  for (const ref of analysis.moduleScopeBrowserGlobals) {
    diagnostics.push({
      code: 'STW083',
      severity: 'warning',
      message: `Browser global '${ref.name}' accessed at module scope. The module will throw on import in SSR / non-browser environments. Move the access inside a component, effect(), or guard with 'typeof ${ref.name} !== "undefined"'.`,
      line: ref.line,
      column: ref.column,
      docsUrl: diagnosticDocsUrl('STW083')
    });
  }

  // STW010 / STW011: Signal referenced but not called in JSX
  for (const uc of analysis.uncalledSignalsInJsx) {
    if (uc.code === 'STW010') {
      diagnostics.push({
        code: 'STW010',
        severity: 'error',
        message: `Signal referenced but not called in JSX child. The function value itself will be rendered, not the signal's current value. Call it: '{sig()}' or wrap as a function child: '{() => sig()}'.`,
        line: uc.line,
        column: uc.column,
        docsUrl: diagnosticDocsUrl('STW010')
      });
    } else {
      diagnostics.push({
        code: 'STW011',
        severity: 'error',
        message: `Signal passed as the value of attribute '${uc.attribute}' on <${uc.element}> instead of its current value. The attribute will be set to the function itself. Call it: '${uc.attribute}={sig()}' (static read) or wrap as '${uc.attribute}={() => sig()}' (reactive).`,
        line: uc.line,
        column: uc.column,
        docsUrl: diagnosticDocsUrl('STW011')
      });
    }
  }

  // STW020 / STW021: eager signal read passed to <Show when> / <For each>
  for (const cf of analysis.eagerControlFlowReads) {
    const message =
      cf.code === 'STW020'
        ? `<Show when> received a value instead of a signal or function. It reads a signal eagerly, so the condition is captured once and will not re-evaluate. Pass the signal directly (when={sig}) or wrap it (when={() => sig()}).`
        : `<For each> received a value instead of a signal or function. It reads a signal eagerly, so the list is captured once and will not react to changes. Pass the signal directly (each={sig}) or wrap it (each={() => sig()}).`;
    diagnostics.push({
      code: cf.code,
      severity: 'error',
      message,
      line: cf.line,
      column: cf.column,
      docsUrl: diagnosticDocsUrl(cf.code)
    });
  }

  // STW090 / STW091: $prop bound to a non-writable target
  for (const t of analysis.twoWayTargetIssues) {
    const message =
      t.code === 'STW090'
        ? `$${t.propName} two-way binding target is not a signal. $${t.propName} compiles to a .set() call, so it needs a writable signal(). Pass a signal, or use a one-way binding (${t.propName}={...}) for a plain value.`
        : `$${t.propName} two-way binding target is read-only (a computed or plain accessor has no .set()). Use a writable signal() for two-way binding, or a one-way binding (${t.propName}={...}) to read it.`;
    diagnostics.push({
      code: t.code,
      severity: 'error',
      message,
      line: t.line,
      column: t.column,
      docsUrl: diagnosticDocsUrl(t.code)
    });
  }

  for (const conflict of analysis.bindingConflicts) {
    if (conflict.type === 'conflict') {
      // STW092: both $prop and prop specified on the same element
      diagnostics.push({
        code: 'STW092',
        severity: 'error',
        message: `<element> has both '${conflict.propName}' and '$${conflict.propName}' attributes. $${conflict.propName} is the two-way binding and implies the value. Remove the plain '${conflict.propName}' attribute.`,
        line: conflict.line,
        column: conflict.column,
        docsUrl: diagnosticDocsUrl('STW092')
      });
    } else if (conflict.type === 'readonly') {
      // STW094: $prop binding on a readonly element
      diagnostics.push({
        code: 'STW094',
        severity: 'warning',
        message: `$${conflict.propName} on readonly element will be downgraded to one-way binding.`,
        line: conflict.line,
        column: conflict.column,
        docsUrl: diagnosticDocsUrl('STW094')
      });
    } else if (conflict.type === 'disabled') {
      // STW095: $prop binding on a disabled element
      diagnostics.push({
        code: 'STW095',
        severity: 'warning',
        message: `$${conflict.propName} on disabled element will be downgraded to one-way binding.`,
        line: conflict.line,
        column: conflict.column,
        docsUrl: diagnosticDocsUrl('STW095')
      });
    }
  }

  return diagnostics;
}
