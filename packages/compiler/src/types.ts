// types.ts — shared types for @stewie/compiler

export type DiagnosticSeverity = 'error' | 'warning'

export interface CompilerDiagnostic {
  severity: DiagnosticSeverity
  message: string
  line: number // 1-based
  column: number // 1-based
  source?: string // source snippet
}

export interface CompileOptions {
  filename: string
  dev?: boolean // default true
  sourcemap?: boolean // default true in dev
  inlineSourcemap?: boolean // default true in dev, false in prod
  /**
   * Enable JSX-to-DOM transformation — replaces native HTML JSX with direct
   * `document.createElement()` calls and fine-grained `effect()` subscriptions.
   * This is the "compiler-driven" differentiator. Defaults to false until the
   * transform is considered stable.
   */
  jsxToDom?: boolean
}

export interface CompileResult {
  code: string
  map?: string // source map JSON string
  diagnostics: CompilerDiagnostic[]
  errors: CompilerDiagnostic[] // subset of diagnostics where severity === 'error'
  warnings: CompilerDiagnostic[] // subset of diagnostics where severity === 'warning'
}
