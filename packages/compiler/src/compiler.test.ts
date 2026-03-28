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
    const result = compile(source, {
      filename: 'test.tsx',
      sourcemap: true,
      inlineSourcemap: false,
    })
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

  it('jsxToDom — injects effect import when file already imports other things from core but not effect', () => {
    // Regression: the old check was `!source.includes("from '@stewie-js/core'")`,
    // which skipped injection when any core import existed — even if effect was absent.
    const source = `import { signal } from '@stewie-js/core'
function App() {
  const active = signal(false)
  return <div class={() => active() ? 'on' : 'off'} />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false, jsxToDom: true })
    expect(result.errors).toHaveLength(0)
    // effect must appear in an import from @stewie-js/core
    expect(result.code).toMatch(/import\s*\{[^}]*\beffect\b[^}]*\}\s*from\s*['"]@stewie-js\/core['"]/)
  })

  it('jsxToDom — does not double-inject effect import when already present', () => {
    const source = `import { signal, effect } from '@stewie-js/core'
function App() {
  const active = signal(false)
  return <div class={() => active() ? 'on' : 'off'} />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false, jsxToDom: true })
    expect(result.errors).toHaveLength(0)
    const matches = result.code.match(/import\s*\{[^}]*\beffect\b[^}]*\}\s*from\s*['"]@stewie-js\/core['"]/g)
    expect(matches).toHaveLength(1)
  })

  it('auto-wrap — ternary with signal read becomes arrow function', () => {
    const source = `
function App() {
  const active = signal(false)
  return <div class={active() ? 'on' : 'off'} />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    expect(result.code).toContain("class={() => active() ? 'on' : 'off'}")
    expect(result.code).not.toContain("class={active()")
  })

  it('auto-wrap — expression child with signal read becomes arrow function', () => {
    const source = `
function App() {
  const count = signal(0)
  return <span>{count() * 2}</span>
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    expect(result.code).toContain('{() => count() * 2}')
  })

  it('auto-wrap — already-wrapped attribute is left unchanged', () => {
    const source = `
function App() {
  const active = signal(false)
  return <div class={() => active() ? 'on' : 'off'} />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    // Arrow function should appear exactly once — not double-wrapped
    expect(result.code).toContain("() => active() ? 'on' : 'off'")
    expect(result.code).not.toContain("() => () =>")
  })

  it('auto-wrap — event handler is not wrapped', () => {
    const source = `
function App() {
  const getHandler = signal(() => {})
  return <button onClick={getHandler()}>click</button>
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    expect(result.code).toContain('onClick={getHandler()}')
    expect(result.code).not.toContain('onClick={() =>')
  })

  it('auto-wrap — component prop is not wrapped', () => {
    const source = `
function App() {
  const sig = signal(false)
  return <MyComp active={sig()} />
}
`
    const result = compile(source, { filename: 'test.tsx', dev: false, sourcemap: false })
    expect(result.errors).toHaveLength(0)
    expect(result.code).toContain('active={sig()}')
    expect(result.code).not.toContain('active={() =>')
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
