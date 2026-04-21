import { describe, it, expect } from 'vitest';
import { parseFile } from './parser.js';
import { analyzeFile } from './analyzer.js';
import { validateFile } from './validator.js';

describe('validateFile()', () => {
  it('STW001 — module-scope signal()', () => {
    const source = `const s = signal(0)\nfunction App() { return <div /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('STW001');
    expect(errors[0].message).toContain('signal()');
    expect(errors[0].message).toContain('module scope');
    expect(errors[0].line).toBe(1);
    expect(errors[0].docsUrl).toBe('https://stewie.dev/diagnostics/STW001');
  });

  it('STW002 — module-scope computed()', () => {
    const source = `const c = computed(() => 1)\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('STW002');
    expect(errors[0].message).toContain('computed()');
  });

  it('STW003 — module-scope store()', () => {
    const source = `const s = store({ a: 1 })\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('STW003');
    expect(errors[0].message).toContain('store()');
  });

  it('STW004 — module-scope effect()', () => {
    const source = `effect(() => {})\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('STW004');
    expect(errors[0].message).toContain('Effects must be owned');
  });

  it('STW092 — $prop + prop conflict', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} value="x" /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('STW092');
    expect(errors[0].message).toContain("'value'");
    expect(errors[0].message).toContain("'$value'");
  });

  it('STW094 — $prop on readonly element', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} readonly /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('STW094');
    expect(warnings[0].message).toContain('one-way binding');
  });

  it('STW095 — $prop on disabled element', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} disabled /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('STW095');
    expect(warnings[0].message).toContain('one-way binding');
  });

  it('STW040 — signal() inside effect() body', () => {
    const source = `function App() {
  effect(() => {
    const s = signal(0)
    console.log(s())
  })
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('STW040');
    expect(errors[0].message).toContain('signal()');
    expect(errors[0].message).toContain('effect()');
  });

  it('STW040 — does not fire for signal() outside the effect body', () => {
    const source = `function App() {
  const s = signal(0)
  effect(() => { console.log(s()) })
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics).toHaveLength(0);
  });

  it('STW042 — effect() inside computed() body', () => {
    const source = `function App() {
  const c = computed(() => {
    effect(() => { console.log('side effect') })
    return 1
  })
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('STW042');
    expect(errors[0].message).toContain('computed()');
  });

  it('STW040 + STW042 — nested effects and computeds track correctly', () => {
    const source = `function App() {
  effect(() => {
    computed(() => {
      effect(() => {})
    })
    const s = signal(0)
    return s
  })
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const codes = diagnostics.map((d) => d.code).sort();
    // Outer effect: signal() inside → STW040
    // computed() inside effect is not currently flagged (only signal in effect)
    // Innermost effect() is inside computed → STW042
    expect(codes).toContain('STW040');
    expect(codes).toContain('STW042');
  });

  it('STW052 — createContext() inside a function', () => {
    const source = `function App() {
  const Ctx = createContext('light')
  return Ctx
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('STW052');
    expect(warnings[0].message).toContain('module scope');
  });

  it('STW052 — does not fire for module-scope createContext()', () => {
    const source = `const Ctx = createContext('light')\nfunction App() { return Ctx }`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics).toHaveLength(0);
  });

  it('STW014 — peek() inside effect() body', () => {
    const source = `function App() {
  const s = signal(0)
  effect(() => { console.log(s.peek()) })
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('STW014');
    expect(warnings[0].message).toContain('peek()');
    expect(warnings[0].message).toContain('effect()');
  });

  it('STW014 — peek() inside computed() body', () => {
    const source = `function App() {
  const s = signal(0)
  const c = computed(() => s.peek() + 1)
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const warnings = diagnostics.filter((d) => d.code === 'STW014');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('computed()');
  });

  it('STW014 — peek() outside reactive context is fine', () => {
    const source = `function App() {
  const s = signal(0)
  const snapshot = s.peek()
  return snapshot
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics.filter((d) => d.code === 'STW014')).toHaveLength(0);
  });

  it('STW022 — <For by> returning a string literal', () => {
    const source = `function App() {
  return <For each={items} by={() => 'x'}>{() => null}</For>
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const warnings = diagnostics.filter((d) => d.code === 'STW022');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('unique');
  });

  it('STW022 — <For by> identity function', () => {
    const source = `function App() {
  return <For each={items} by={(x) => x}>{() => null}</For>
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const warnings = diagnostics.filter((d) => d.code === 'STW022');
    expect(warnings).toHaveLength(1);
  });

  it('STW022 — <For by={(item) => item.id}> is fine', () => {
    const source = `function App() {
  return <For each={items} by={(item) => item.id}>{() => null}</For>
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics.filter((d) => d.code === 'STW022')).toHaveLength(0);
  });

  it('STW073 — <Link to> absolute https URL', () => {
    const source = `function App() {
  return <Link to="https://example.com">Docs</Link>
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const warnings = diagnostics.filter((d) => d.code === 'STW073');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('external');
  });

  it('STW073 — <Link to> protocol-relative URL', () => {
    const source = `function App() {
  return <Link to="//example.com/x">Docs</Link>
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics.filter((d) => d.code === 'STW073')).toHaveLength(1);
  });

  it('STW073 — <Link to> internal path is fine', () => {
    const source = `function App() {
  return <Link to="/projects/42">Project</Link>
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics.filter((d) => d.code === 'STW073')).toHaveLength(0);
  });

  it('STW083 — window.location at module scope', () => {
    const source = `const origin = window.location.origin\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.code === 'STW083');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('window');
    expect(errors[0].message).toContain('SSR');
  });

  it('STW083 — document.title at module scope', () => {
    const source = `document.title = 'x'\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics.filter((d) => d.code === 'STW083')).toHaveLength(1);
  });

  it('STW083 — window.X inside a function is fine', () => {
    const source = `function App() {
  const x = window.location.origin
  return x
}`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics.filter((d) => d.code === 'STW083')).toHaveLength(0);
  });

  it('STW083 — object literal key named window is fine', () => {
    const source = `const map = { window: 1 }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics.filter((d) => d.code === 'STW083')).toHaveLength(0);
  });

  it('emits no diagnostics for clean component', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} /> }\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));
    expect(diagnostics).toHaveLength(0);
  });

  it('correct line number for module-scope reactive calls', () => {
    const source = `// comment\nconst s = signal(0)\n`;
    const parsed = parseFile(source, 'test.tsx');
    const diagnostics = validateFile(parsed, analyzeFile(parsed));

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
  });
});
