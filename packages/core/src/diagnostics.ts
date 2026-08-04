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

// Points at the published diagnostics reference. Each code is an anchor on that
// page (e.g. #stw001), so a message's docs link deep-links to its own entry.
// Update this base if the docs move to a custom domain.
const DOCS_BASE = 'https://cwins.github.io/stewie-js/reference/diagnostics';

export function diagnosticDocsUrl(code: string): string {
  return `${DOCS_BASE}#${code.toLowerCase()}`;
}
