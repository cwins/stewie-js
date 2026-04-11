// types.ts — shared types for @stewie-js/compiler

import type ts from 'typescript';

export type DiagnosticSeverity = 'error' | 'warning';

export interface CompilerDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line: number; // 1-based
  column: number; // 1-based
  source?: string; // source snippet
}

export interface CompileOptions {
  filename: string;
  dev?: boolean; // default true
  sourcemap?: boolean; // default true in dev
  inlineSourcemap?: boolean; // default true in dev, false in prod
  /**
   * Enable JSX-to-DOM transformation — replaces native HTML JSX with direct
   * `document.createElement()` calls and fine-grained `effect()` subscriptions.
   * This is the "compiler-driven" differentiator. Defaults to false until the
   * transform is considered stable.
   */
  jsxToDom?: boolean;
  /**
   * TypeScript program created from the project's tsconfig. When provided and
   * the compiled file is included in the program with matching content, the
   * compiler uses the type checker to determine whether expressions actually
   * read Signal<T>/Computed<T> values before wrapping them in () =>. Without
   * this, the compiler falls back to a syntax-only heuristic that may
   * over-wrap plain property accesses like `{row().id}`.
   *
   * Obtain via `createProjectProgram(root)` from this package, or via
   * `ts.createProgram(fileNames, options).getTypeChecker()`.
   * The Vite plugin (`stewie()`) provides this automatically.
   */
  program?: ts.Program;
}

export interface CompileResult {
  code: string;
  map?: string; // source map JSON string
  diagnostics: CompilerDiagnostic[];
  errors: CompilerDiagnostic[]; // subset of diagnostics where severity === 'error'
  warnings: CompilerDiagnostic[]; // subset of diagnostics where severity === 'warning'
}
