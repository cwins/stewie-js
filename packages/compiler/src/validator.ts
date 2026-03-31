// validator.ts — emit diagnostics based on analysis results

import type { ParsedFile } from './parser.js';
import type { AnalysisResult } from './analyzer.js';
import type { CompilerDiagnostic } from './types.js';

export function validateFile(_parsed: ParsedFile, analysis: AnalysisResult): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];

  // Hard error for each module-scope reactive call
  for (const call of analysis.moduleScopeReactiveCalls) {
    diagnostics.push({
      severity: 'error',
      message: `signal()/store() must not be called at module scope. Move it inside a component or function.`,
      line: call.line,
      column: call.column
    });
  }

  // Hard error for $value + value conflict
  for (const conflict of analysis.bindingConflicts) {
    if (conflict.type === 'conflict') {
      diagnostics.push({
        severity: 'error',
        message: `Conflicting bindings: $${conflict.propName} and ${conflict.propName} cannot be used together on the same element.`,
        line: conflict.line,
        column: conflict.column
      });
    } else if (conflict.type === 'readonly') {
      diagnostics.push({
        severity: 'warning',
        message: `$${conflict.propName} on readonly element will be downgraded to one-way binding.`,
        line: conflict.line,
        column: conflict.column
      });
    } else if (conflict.type === 'disabled') {
      diagnostics.push({
        severity: 'warning',
        message: `$${conflict.propName} on disabled element will be downgraded to one-way binding.`,
        line: conflict.line,
        column: conflict.column
      });
    }
  }

  return diagnostics;
}
