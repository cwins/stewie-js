// @stewie-js/compiler — TSX to fine-grained reactive output
export const version = '0.7.0';

import { parseFile } from './parser.js';
import { analyzeFile } from './analyzer.js';
import { validateFile } from './validator.js';
import { transformFile } from './transformer.js';
import { generateIdentitySourceMap, toInlineSourceMap } from './sourcemap.js';
import type { CompileOptions, CompileResult } from './types.js';

export type { CompileOptions, CompileResult, CompilerDiagnostic, DiagnosticSeverity } from './types.js';
export type { ParsedFile } from './parser.js';
export type {
  AnalysisResult,
  ReactiveAttribute,
  TwoWayBinding,
  ModuleScopeCall,
  BindingConflict,
  AutoWrapCandidate
} from './analyzer.js';
export { parseFile } from './parser.js';
export { analyzeFile } from './analyzer.js';
export { validateFile } from './validator.js';
export { transformFile } from './transformer.js';
export { generateSourceMap, generateIdentitySourceMap, toInlineSourceMap } from './sourcemap.js';
export type { SourceMapEntry } from './sourcemap.js';
export { canTransformJsx, emitJsxToDom, findJsxReplacements } from './dom-emitter.js';
export type { JsxReplacement } from './dom-emitter.js';

export function compile(source: string, options: CompileOptions): CompileResult {
  const dev = options.dev ?? true;
  const sourcemap = options.sourcemap ?? dev;
  const inlineSourcemap = options.inlineSourcemap ?? (dev ? true : false);

  // 1. Parse
  const parsed = parseFile(source, options.filename);

  // 2. Analyze
  const analysis = analyzeFile(parsed);

  // 3. Validate
  const diagnostics = validateFile(parsed, analysis);

  // 4. Transform (only if no hard errors)
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  let code: string;
  if (errors.length > 0) {
    // Don't transform if there are errors — return original source
    code = source;
  } else {
    code = transformFile(parsed, analysis, { jsxToDom: options.jsxToDom });
  }

  // 5. Optionally generate source map
  let map: string | undefined;
  if (sourcemap) {
    const mapJson = generateIdentitySourceMap(options.filename, source);
    map = mapJson;

    if (inlineSourcemap) {
      code = code + '\n' + toInlineSourceMap(mapJson);
    }
  }

  return {
    code,
    map,
    diagnostics,
    errors,
    warnings
  };
}

// CLI entry (only runs when executed directly)
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const filepath = process.argv[2];
  if (!filepath) {
    console.error('Usage: stewie-compiler <file>');
    process.exit(1);
  }

  const source = readFileSync(resolve(filepath), 'utf-8');
  const result = compile(source, {
    filename: filepath,
    dev: true,
    sourcemap: true,
    inlineSourcemap: false
  });

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(`Error [${err.line}:${err.column}]: ${err.message}`);
    }
    process.exit(1);
  }

  for (const warn of result.warnings) {
    console.warn(`Warning [${warn.line}:${warn.column}]: ${warn.message}`);
  }

  console.log(result.code);
}
