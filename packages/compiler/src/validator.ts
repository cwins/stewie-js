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
  effect: 'STW004'
};

function moduleScopeMessage(callee: string): string {
  if (callee === 'effect') {
    return `effect() called at module scope. Effects must be owned by a component or reactiveScope() so they can be disposed.`;
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
