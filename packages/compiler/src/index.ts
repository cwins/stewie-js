// @stewie-js/compiler — TSX to fine-grained reactive output
export const version = '0.7.0';

import ts from 'typescript';
import { dirname } from 'node:path';
import { parseFile } from './parser.js';
import { analyzeFile } from './analyzer.js';
import { validateFile } from './validator.js';
import { transformFile } from './transformer.js';
import { generateIdentitySourceMap, toInlineSourceMap } from './sourcemap.js';
import type { CompileOptions, CompileResult } from './types.js';

export type { CompileOptions, CompileResult, CompilerDiagnostic, DiagnosticSeverity } from './types.js';
export type { Program as TsProgram } from 'typescript';
export type { ParsedFile } from './parser.js';
export type { AnalysisResult, ReactiveAttribute, TwoWayBinding, ModuleScopeCall, BindingConflict, AutoWrapCandidate } from './analyzer.js';
export { parseFile } from './parser.js';
export { analyzeFile } from './analyzer.js';
export { validateFile } from './validator.js';
export { transformFile } from './transformer.js';
export { generateSourceMap, generateIdentitySourceMap, toInlineSourceMap } from './sourcemap.js';
export type { SourceMapEntry } from './sourcemap.js';
export { canTransformJsx, emitJsxToDom, findJsxReplacements } from './dom-emitter.js';
export type { JsxReplacement } from './dom-emitter.js';

/**
 * Create a TypeScript program from the tsconfig found at or above `root`.
 * Returns undefined if no tsconfig is found or program creation fails.
 * The caller is responsible for caching the result — program creation is
 * expensive (~200-500 ms for a typical project).
 */
export function createProjectProgram(root: string): ts.Program | undefined {
  try {
    const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) return undefined;

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) return undefined;

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      dirname(configPath)
    );

    return ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
  } catch {
    return undefined;
  }
}

export function compile(source: string, options: CompileOptions): CompileResult {
  const dev = options.dev ?? true;
  const sourcemap = options.sourcemap ?? dev;
  const inlineSourcemap = options.inlineSourcemap ?? (dev ? true : false);

  // 1. Parse — use program's source file when content matches, which gives
  //    the type checker access to type information for this file.
  let checker: ts.TypeChecker | undefined;
  let parsed = parseFile(source, options.filename);

  if (options.program) {
    const programSF = options.program.getSourceFile(options.filename);
    // Only use the program's AST when the on-disk content matches the source
    // being compiled. During HMR the content may diverge; in that case we fall
    // back to heuristic-only analysis (no regression — still correct, may
    // over-wrap slightly until the next full rebuild).
    if (programSF && programSF.text === source) {
      parsed = { sourceFile: programSF, source, filename: options.filename };
      checker = options.program.getTypeChecker();
    }
  }

  // 2. Analyze
  const analysis = analyzeFile(parsed, checker);

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
