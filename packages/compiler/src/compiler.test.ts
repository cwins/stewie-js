import { describe, it, expect } from 'vitest'
import { compile } from './index.js'

describe('compile()', () => {
  it('reactive attribute — function value passes through as function', () => {
    const source = `
function App() {
  const active = signal(false)
  return <div class={() => active() ? 'on' : 'off'} />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    // The class attribute should still have the arrow function
    expect(result.code).toContain('() => active() ?')
  })

  it('static attribute — passes through unchanged', () => {
    const source = `
function App() {
  return <div class="foo" />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    expect(result.code).toContain('class="foo"')
    // No subscription added for static attribute
    expect(result.code).not.toContain('subscribe')
  })

  it('$prop expansion — $value={sig} becomes value={sig()} and onInput handler', () => {
    const source = `
function App() {
  const sig = signal('')
  return <input $value={sig} />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    expect(result.code).toContain('value={sig()}')
    expect(result.code).toContain('onInput=')
    expect(result.code).not.toContain('$value')
  })

  it('$prop + value conflict → hard error', () => {
    const source = `
function App() {
  const sig = signal('')
  return <input $value={sig} value="foo" />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('Conflicting bindings')
    expect(result.errors[0].message).toContain('$value')
    expect(result.errors[0].message).toContain('value')
  })

  it('$prop + readonly → warning + one-way output (no onInput)', () => {
    const source = `
function App() {
  const sig = signal('')
  return <input $value={sig} readonly />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('one-way binding')
    expect(result.code).toContain('value={sig()}')
    expect(result.code).not.toContain('onInput=')
  })

  it('module-level signal call → hard error with line number', () => {
    const source = `const s = signal(0)

function App() {
  return <div />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].line).toBe(1)
    expect(result.errors[0].message).toContain('module scope')
  })

  it('source map is generated when sourcemap: true', () => {
    const source = `
function App() {
  return <div class="hello" />
}
`
    const result = compile(source, { filename: 'test.tsx', sourcemap: true, inlineSourcemap: false })
    expect(result.map).toBeTruthy()
    expect(typeof result.map).toBe('string')

    const map = JSON.parse(result.map!)
    expect(map.version).toBe(3)
    expect(map.sources).toContain('test.tsx')
  })

  it('module-level computed call → hard error', () => {
    const source = `const c = computed(() => 42)
function App() { return <div /> }
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].message).toContain('module scope')
  })

  it('$prop + disabled → warning + one-way output', () => {
    const source = `
function App() {
  const sig = signal('')
  return <input $value={sig} disabled />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('one-way binding')
    expect(result.code).toContain('value={sig()}')
    expect(result.code).not.toContain('onInput=')
  })

  it('inline sourcemap is appended to code when inlineSourcemap: true', () => {
    const source = `function App() { return <div /> }\n`
    const result = compile(source, {
      filename: 'test.tsx',
      sourcemap: true,
      inlineSourcemap: true,
    })
    expect(result.code).toContain('//# sourceMappingURL=data:application/json;base64,')
  })
})
