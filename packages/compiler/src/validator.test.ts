import { describe, it, expect } from 'vitest'
import { parseFile } from './parser.js'
import { analyzeFile } from './analyzer.js'
import { validateFile } from './validator.js'

describe('validateFile()', () => {
  it('emits error for module-scope signal()', () => {
    const source = `const s = signal(0)\nfunction App() { return <div /> }\n`
    const parsed = parseFile(source, 'test.tsx')
    const analysis = analyzeFile(parsed)
    const diagnostics = validateFile(parsed, analysis)

    const errors = diagnostics.filter(d => d.severity === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('module scope')
    expect(errors[0].line).toBe(1)
  })

  it('emits error for module-scope store()', () => {
    const source = `const s = store({ a: 1 })\nfunction App() { return <div /> }\n`
    const parsed = parseFile(source, 'test.tsx')
    const analysis = analyzeFile(parsed)
    const diagnostics = validateFile(parsed, analysis)

    const errors = diagnostics.filter(d => d.severity === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('module scope')
  })

  it('emits error for $value + value conflict', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} value="x" /> }\n`
    const parsed = parseFile(source, 'test.tsx')
    const analysis = analyzeFile(parsed)
    const diagnostics = validateFile(parsed, analysis)

    const errors = diagnostics.filter(d => d.severity === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('Conflicting bindings')
  })

  it('emits warning for $value + readonly', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} readonly /> }\n`
    const parsed = parseFile(source, 'test.tsx')
    const analysis = analyzeFile(parsed)
    const diagnostics = validateFile(parsed, analysis)

    const warnings = diagnostics.filter(d => d.severity === 'warning')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('one-way binding')
  })

  it('emits warning for $value + disabled', () => {
    const source = `function App() { const sig = signal(''); return <input $value={sig} disabled /> }\n`
    const parsed = parseFile(source, 'test.tsx')
    const analysis = analyzeFile(parsed)
    const diagnostics = validateFile(parsed, analysis)

    const warnings = diagnostics.filter(d => d.severity === 'warning')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toContain('one-way binding')
  })

  it('emits no diagnostics for clean component', () => {
    const source = `
function App() {
  const sig = signal('')
  return <input $value={sig} />
}
`
    const parsed = parseFile(source, 'test.tsx')
    const analysis = analyzeFile(parsed)
    const diagnostics = validateFile(parsed, analysis)

    expect(diagnostics).toHaveLength(0)
  })

  it('correct line number for module-scope reactive calls', () => {
    const source = `// comment\nconst s = signal(0)\n`
    const parsed = parseFile(source, 'test.tsx')
    const analysis = analyzeFile(parsed)
    const diagnostics = validateFile(parsed, analysis)

    const errors = diagnostics.filter(d => d.severity === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBe(2)
  })
})
