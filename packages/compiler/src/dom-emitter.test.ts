import { describe, it, expect } from 'vitest'
import { compile } from './index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compileJsx(source: string): string {
  const result = compile(source, {
    filename: 'test.tsx',
    dev: false,
    sourcemap: false,
    jsxToDom: true,
  })
  // Fail the test if there are compile errors
  if (result.errors.length > 0) {
    throw new Error(result.errors.map((e) => e.message).join('\n'))
  }
  return result.code
}

// Strip all whitespace for comparison (normalise indentation differences)
function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// canTransformJsx / basic transformation detection
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: transformability', () => {
  it('transforms a simple native element', () => {
    const code = compileJsx(`
      function Comp() {
        return <div class="x">hello</div>
      }
    `)
    expect(code).toContain('document.createElement("div")')
    expect(code).not.toContain('jsx(')
    expect(code).toContain('"hello"')
  })

  it('does NOT transform component JSX (uppercase tag)', () => {
    const code = compileJsx(`
      function Outer() {
        return <MyWidget />
      }
    `)
    // Should be left as-is (JSX, not DOM)
    expect(code).not.toContain('document.createElement')
    expect(code).toContain('<MyWidget />')
  })

  it('does NOT transform native element containing a component child', () => {
    const code = compileJsx(`
      function Outer() {
        return <div><Inner /></div>
      }
    `)
    expect(code).not.toContain('document.createElement')
    expect(code).toContain('<div>')
  })
})

// ---------------------------------------------------------------------------
// Static attributes
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: static attributes', () => {
  it('emits className for class=""', () => {
    const code = compileJsx(`function C() { return <div class="foo"></div> }`)
    expect(normalise(code)).toContain(`__el0.className = "foo"`)
  })

  it('emits property assignment for id=""', () => {
    const code = compileJsx(`function C() { return <span id="main"></span> }`)
    expect(normalise(code)).toContain(`__el0.id = "main"`)
  })

  it('emits boolean attribute via setAttribute', () => {
    const code = compileJsx(`function C() { return <input disabled /> }`)
    expect(normalise(code)).toContain(`__el0.setAttribute("disabled", "")`)
  })
})

// ---------------------------------------------------------------------------
// Reactive attributes
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: reactive attributes', () => {
  it('wraps arrow-function attribute in effect()', () => {
    const code = compileJsx(`
      function C() {
        const active = signal(false)
        return <div class={() => active() ? 'on' : 'off'}></div>
      }
    `)
    expect(code).toContain('effect(')
    expect(code).toContain('__el0.className =')
    expect(code).toContain(`active() ? 'on' : 'off'`)
  })

  it('wraps zero-arg signal call in effect()', () => {
    const code = compileJsx(`
      function C() {
        const label = signal('hello')
        return <div title={label()}></div>
      }
    `)
    expect(code).toContain('effect(')
    expect(code).toContain('__el0.title = label()')
  })

  it('assigns static expression directly (no effect)', () => {
    const code = compileJsx(`
      function C() {
        const name = 'world'
        return <div id={name}></div>
      }
    `)
    expect(code).not.toContain('effect(')
    expect(code).toContain('__el0.id = name')
  })
})

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: event handlers', () => {
  it('wires onClick as addEventListener("click", ...)', () => {
    const code = compileJsx(`function C() { return <button onClick={() => console.log('hi')}></button> }`)
    expect(code).toContain(`addEventListener("click"`)
    expect(code).not.toContain('onClick')
  })

  it('wires onInput as addEventListener("input", ...)', () => {
    const code = compileJsx(`function C() { return <input onInput={(e) => console.log(e)} /> }`)
    expect(code).toContain(`addEventListener("input"`)
  })
})

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: children', () => {
  it('appends static text as createTextNode', () => {
    const code = compileJsx(`function C() { return <p>Hello world</p> }`)
    expect(code).toContain('document.createTextNode(')
    expect(code).toContain('"Hello world"')
    expect(code).toContain('appendChild(')
  })

  it('wraps reactive text child in effect()', () => {
    const code = compileJsx(`
      function C() {
        const count = signal(0)
        return <span>{count()}</span>
      }
    `)
    expect(code).toContain('document.createTextNode(\'\')')
    expect(code).toContain('effect(')
    expect(code).toContain('nodeValue')
    expect(code).toContain('count()')
  })

  it('nests child elements correctly', () => {
    const code = compileJsx(`
      function C() {
        return <ul><li>a</li><li>b</li></ul>
      }
    `)
    const n = normalise(code)
    expect(n).toContain('document.createElement("ul")')
    expect(n).toContain('document.createElement("li")')
    // Both <li> elements should be appended to the <ul>
    expect(n.match(/appendChild/g)?.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// IIFE wrapper
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: IIFE wrapper', () => {
  it('wraps generated code in an IIFE that returns the element', () => {
    const code = compileJsx(`function C() { return <div></div> }`)
    expect(code).toContain('(() => {')
    expect(code).toContain('return __el0')
    expect(code).toContain('})()')
  })
})

// ---------------------------------------------------------------------------
// $prop expansion still works with jsxToDom enabled
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: $prop expansion is unaffected', () => {
  it('expands $value binding even when jsxToDom is on', () => {
    const code = compileJsx(`
      function C() {
        const name = signal('')
        return <input $value={name} />
      }
    `)
    // Input is a native element but $value makes it a two-way binding
    // The $prop transformer runs first and expands it; then jsxToDom runs
    expect(code).toContain('name()')
    expect(code).toContain('onInput')
  })
})

// ---------------------------------------------------------------------------
// effect import injection
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: auto-imports effect', () => {
  it('injects effect import when file has no @stewie-js/core import', () => {
    const code = compileJsx(`
      function C() {
        const x = signal(0)
        return <div class={() => x() ? 'a' : 'b'}></div>
      }
    `)
    expect(code).toMatch(/import \{ effect \} from '@stewie-js\/core'/)
  })

  it('does not double-import when @stewie-js/core already imported', () => {
    const code = compileJsx(`
      import { signal, effect } from '@stewie-js/core'
      function C() {
        const x = signal(0)
        return <div class={() => x() ? 'a' : 'b'}></div>
      }
    `)
    const effectImports = (code.match(/import.*effect.*from '@stewie-js\/core'/g) ?? []).length
    // Should not duplicate
    expect(effectImports).toBeLessThanOrEqual(1)
  })
})
