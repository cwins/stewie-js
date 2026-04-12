import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { parseFile } from './parser.js';
import { analyzeFile } from './analyzer.js';
import type { ParsedFile } from './parser.js';

// ---------------------------------------------------------------------------
// In-memory TypeScript program helper for type-aware tests.
// Builds a real ts.Program from an in-memory source string so that
// TypeChecker.getTypeAtLocation() works correctly on the AST nodes.
// ---------------------------------------------------------------------------

function createInMemoryProgram(
  filename: string,
  source: string
): {
  program: ts.Program;
  parsed: ParsedFile;
} {
  // Create the source file once — shared between the program and the parsed result.
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, /* setParentNodes */ true, ts.ScriptKind.TSX);

  const defaultHost = ts.createCompilerHost({});
  const host: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile(name, target) {
      if (name === filename) return sourceFile;
      return defaultHost.getSourceFile(name, target);
    },
    fileExists(name) {
      return name === filename || defaultHost.fileExists(name);
    },
    readFile(name) {
      if (name === filename) return source;
      return defaultHost.readFile(name);
    }
  };

  const program = ts.createProgram(
    [filename],
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: '@stewie-js/core',
      strict: true,
      noEmit: true,
      // Skip lib checks to avoid noise from missing @stewie-js/core types
      skipLibCheck: true
    },
    host
  );

  // The program re-uses the same sourceFile object we passed via the host,
  // so nodes from `parsed.sourceFile` are the same as those in the program.
  const parsed: ParsedFile = { sourceFile, source, filename };
  return { program, parsed };
}

describe('analyzeFile()', () => {
  it('detects module-scope signal() call', () => {
    const source = `const s = signal(0)\nfunction App() { return <div /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.moduleScopeReactiveCalls).toHaveLength(1);
    expect(result.moduleScopeReactiveCalls[0].callee).toBe('signal');
    expect(result.moduleScopeReactiveCalls[0].line).toBe(1);
  });

  it('detects module-scope store() call', () => {
    const source = `const s = store({ count: 0 })\nfunction App() { return <div /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.moduleScopeReactiveCalls).toHaveLength(1);
    expect(result.moduleScopeReactiveCalls[0].callee).toBe('store');
  });

  it('detects module-scope computed() call', () => {
    const source = `const c = computed(() => 1)\nfunction App() { return <div /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.moduleScopeReactiveCalls).toHaveLength(1);
    expect(result.moduleScopeReactiveCalls[0].callee).toBe('computed');
  });

  it('does NOT flag signal() inside a function', () => {
    const source = `function App() { const s = signal(0); return <div /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.moduleScopeReactiveCalls).toHaveLength(0);
  });

  it('detects reactive arrow function attribute', () => {
    const source = `function App() { return <div class={() => 'foo'} /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.reactiveAttributes).toHaveLength(1);
    expect(result.reactiveAttributes[0].attributeName).toBe('class');
    expect(result.reactiveAttributes[0].isReactive).toBe(true);
  });

  it('detects static attribute as non-reactive', () => {
    const source = `function App() { return <div class="foo" /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    // Static string literal attributes have no JsxExpression initializer, so not in reactiveAttributes
    expect(result.reactiveAttributes.filter((a) => a.isReactive)).toHaveLength(0);
  });

  it('detects $value two-way binding', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.twoWayBindings).toHaveLength(1);
    expect(result.twoWayBindings[0].propName).toBe('value');
    expect(result.twoWayBindings[0].signalExpression).toBe('sig');
    expect(result.twoWayBindings[0].hasConflictingValue).toBe(false);
    expect(result.twoWayBindings[0].hasReadonly).toBe(false);
    expect(result.twoWayBindings[0].hasDisabled).toBe(false);
  });

  it('detects conflict when $value and value are both present', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} value="x" /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.twoWayBindings[0].hasConflictingValue).toBe(true);
    expect(result.bindingConflicts.some((c) => c.type === 'conflict')).toBe(true);
  });

  it('detects readonly flag on $value binding', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} readonly /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.twoWayBindings[0].hasReadonly).toBe(true);
    expect(result.bindingConflicts.some((c) => c.type === 'readonly')).toBe(true);
  });

  it('detects disabled flag on $value binding', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} disabled /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.twoWayBindings[0].hasDisabled).toBe(true);
    expect(result.bindingConflicts.some((c) => c.type === 'disabled')).toBe(true);
  });

  it('auto-wrap — detects signal read in ternary attribute', () => {
    const source = `function App() { const active = signal(false); return <div class={active() ? 'on' : 'off'} /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.autoWrapCandidates).toHaveLength(1);
    expect(result.autoWrapCandidates[0].expressionText).toBe("active() ? 'on' : 'off'");
  });

  it('auto-wrap — skips attribute already wrapped in arrow function', () => {
    const source = `function App() { const active = signal(false); return <div class={() => active() ? 'on' : 'off'} /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.autoWrapCandidates).toHaveLength(0);
  });

  it('auto-wrap — skips event handler (on* attribute)', () => {
    const source = `function App() { const handler = signal(() => {}); return <div onClick={handler()} /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.autoWrapCandidates).toHaveLength(0);
  });

  it('auto-wrap — skips custom component props', () => {
    const source = `function App() { const sig = signal(false); return <MyComp active={sig()} /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.autoWrapCandidates).toHaveLength(0);
  });

  it('auto-wrap — detects signal read in JSX expression child', () => {
    const source = `function App() { const count = signal(0); return <span>{count()}</span> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.autoWrapCandidates).toHaveLength(1);
    expect(result.autoWrapCandidates[0].expressionText).toBe('count()');
  });

  it('auto-wrap — skips static attribute with no signal reads', () => {
    const source = `function App() { return <div class="foo" /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed);
    expect(result.autoWrapCandidates).toHaveLength(0);
  });

  it('store path tracking — reads store.a.b', () => {
    const source = `
function App() {
  const st = store({ a: { b: 0 } })
  const val = st.a.b
  return <div>{val}</div>
}
`;
    const parsed = parseFile(source, 'test.tsx');
    // Analysis should complete without error; store paths are available for future use
    const result = analyzeFile(parsed);
    // No module-scope calls (store is inside App)
    expect(result.moduleScopeReactiveCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Type-aware auto-wrap tests (Compiler Bug 1)
//
// The heuristic wraps any expression containing a no-arg identifier call,
// which over-wraps `{row().id}` when `id` is a plain number.  When a
// TypeChecker is supplied, analyzeFile() only wraps expressions that
// actually call a Signal<T>/Computed<T> value.
// ---------------------------------------------------------------------------

// Minimal Signal/Computed type declarations used in the in-memory test source.
const SIGNAL_DECLS = `
interface Signal<T> { (): T; peek(): T; set(v: T): void; update(fn: (p: T) => T): void; }
interface Computed<T> { (): T; peek(): T; }
`;

describe('analyzeFile() — type-aware auto-wrap (with TypeChecker)', () => {
  it('does NOT wrap {getRow().id} when id is a plain number', () => {
    const source = `${SIGNAL_DECLS}
declare function getRow(): { id: number; label: Signal<string>; };
function App() { return <span>{getRow().id}</span> }
`;
    const { program, parsed } = createInMemoryProgram('test.tsx', source);
    const checker = program.getTypeChecker();
    const result = analyzeFile(parsed, checker);
    expect(result.autoWrapCandidates).toHaveLength(0);
  });

  it('DOES wrap {getRow().label()} when label is a Signal<string>', () => {
    const source = `${SIGNAL_DECLS}
declare function getRow(): { id: number; label: Signal<string>; };
function App() { return <span>{getRow().label()}</span> }
`;
    const { program, parsed } = createInMemoryProgram('test.tsx', source);
    const checker = program.getTypeChecker();
    const result = analyzeFile(parsed, checker);
    expect(result.autoWrapCandidates).toHaveLength(1);
    expect(result.autoWrapCandidates[0].expressionText).toBe('getRow().label()');
  });

  it('DOES wrap {count()} when count is a Signal<number>', () => {
    const source = `${SIGNAL_DECLS}
declare const count: Signal<number>;
function App() { return <span>{count()}</span> }
`;
    const { program, parsed } = createInMemoryProgram('test.tsx', source);
    const checker = program.getTypeChecker();
    const result = analyzeFile(parsed, checker);
    expect(result.autoWrapCandidates).toHaveLength(1);
    expect(result.autoWrapCandidates[0].expressionText).toBe('count()');
  });

  it('DOES wrap {count() + 1} when count is a Signal<number>', () => {
    const source = `${SIGNAL_DECLS}
declare const count: Signal<number>;
function App() { return <span>{count() + 1}</span> }
`;
    const { program, parsed } = createInMemoryProgram('test.tsx', source);
    const checker = program.getTypeChecker();
    const result = analyzeFile(parsed, checker);
    expect(result.autoWrapCandidates).toHaveLength(1);
    expect(result.autoWrapCandidates[0].expressionText).toBe('count() + 1');
  });

  it('does NOT wrap {getItem().done} on a plain getter (benchmark pattern)', () => {
    const source = `${SIGNAL_DECLS}
interface Row { id: number; done: boolean; text: string; }
declare function getItem(): Row;
function App() { return <li class={getItem().done ? 'done' : ''}>{getItem().text}</li> }
`;
    const { program, parsed } = createInMemoryProgram('test.tsx', source);
    const checker = program.getTypeChecker();
    const result = analyzeFile(parsed, checker);
    // Neither getItem().done nor getItem().text read a signal — should not wrap.
    expect(result.autoWrapCandidates).toHaveLength(0);
  });

  it('heuristic fallback — still wraps without TypeChecker (existing behavior preserved)', () => {
    // Without a checker, the heuristic sees getRow() (no-arg identifier call) and wraps.
    const source = `
declare function getRow(): { id: number };
function App() { return <span>{getRow().id}</span> }
`;
    const parsed = parseFile(source, 'test.tsx');
    const result = analyzeFile(parsed); // no checker
    expect(result.autoWrapCandidates).toHaveLength(1);
  });
});
