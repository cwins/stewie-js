// Diagnostic record shared between the compiler (build-time) and the
// dev-runtime logger. Kept intentionally small: code + severity + message +
// source location + optional docs URL. Flat `line`/`column` rather than a
// nested `loc` because @stewie-js/vite already expects that shape when
// relaying compiler diagnostics to Vite.
//
// Each code is listed in /DIAGNOSTICS.md with its detection path and the
// rationale for the rule.

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  line: number;
  column: number;
  docsUrl?: string;
}

const DOCS_BASE = 'https://stewie.dev/diagnostics/';

export function diagnosticDocsUrl(code: string): string {
  return DOCS_BASE + code;
}
