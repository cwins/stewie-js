import { describe, it, expect } from 'vitest';
import { parseFile } from './parser.js';
import { analyzeFile } from './analyzer.js';

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
