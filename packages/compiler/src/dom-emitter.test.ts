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

  it('merges effect into existing @stewie-js/core import instead of duplicating', () => {
    const code = compileJsx(`
      import { signal } from '@stewie-js/core'
      function C() {
        const x = signal(0)
        return <div class={() => x() ? 'a' : 'b'}></div>
      }
    `)
    // effect should be added to the existing import, not a second import line
    const importLines = code.split('\n').filter((l) => l.includes('@stewie-js/core'))
    expect(importLines.length).toBe(1)
    expect(importLines[0]).toContain('effect')
    expect(importLines[0]).toContain('signal')
  })
})

// ---------------------------------------------------------------------------
// JSX expression children — only safe if no nested JSX
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: JSX-expression children', () => {
  it('does NOT transform element whose child expression contains JSX', () => {
    // items.map(item => <li>...</li>) cannot be emitted as a text node
    const code = compileJsx(`
      function C() {
        const items = ['a', 'b']
        return <ul>{items.map(item => <li>{item}</li>)}</ul>
      }
    `)
    // The <ul> should not be transformed — it falls back to the JSX runtime
    expect(code).not.toContain('document.createElement("ul")')
  })

  it('DOES transform element whose child expression is a simple reactive value', () => {
    const code = compileJsx(`
      function C() {
        const count = signal(0)
        return <p>{count()}</p>
      }
    `)
    expect(code).toContain('document.createElement("p")')
    expect(code).toContain('effect(')
    expect(code).toContain('nodeValue')
  })
})

// ---------------------------------------------------------------------------
// Complex reactive expressions (count() + 1, items().length)
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: complex reactive expressions', () => {
  it('treats count() + 1 as reactive (wraps in effect)', () => {
    const code = compileJsx(`
      function C() {
        const count = signal(0)
        return <div>{count() + 1}</div>
      }
    `)
    expect(code).toContain('effect(')
    expect(code).toContain('count() + 1')
  })

  it('treats items().length as reactive (wraps in effect)', () => {
    const code = compileJsx(`
      function C() {
        const items = signal([])
        return <span>{items().length}</span>
      }
    `)
    expect(code).toContain('effect(')
    expect(code).toContain('items().length')
  })
})

// ---------------------------------------------------------------------------
// key prop — skipped (no DOM output)
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: key prop is skipped', () => {
  it('does not emit anything for key prop', () => {
    const code = compileJsx(`
      function C() {
        return <div key="k1" id="main"></div>
      }
    `)
    expect(code).not.toContain('"key"')
    expect(code).toContain('__el0.id = "main"')
  })
})

// ---------------------------------------------------------------------------
// ref prop — callback and object form
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: ref prop', () => {
  it('calls arrow-function ref with the element', () => {
    const code = compileJsx(`
      function C() {
        return <input ref={(el) => console.log(el)} />
      }
    `)
    expect(normalise(code)).toContain('((el) => console.log(el))(__el0)')
  })

  it('supports ref object (.current assignment)', () => {
    const code = compileJsx(`
      function C() {
        const myRef = { current: null }
        return <div ref={myRef}></div>
      }
    `)
    expect(normalise(code)).toContain('myRef.current = __el0')
  })
})

// ---------------------------------------------------------------------------
// style prop — object form
// ---------------------------------------------------------------------------

describe('JSX-to-DOM: style prop', () => {
  it('emits Object.assign for static style object', () => {
    const code = compileJsx(`
      function C() {
        return <div style={{ color: 'red', fontSize: 14 }}></div>
      }
    `)
    expect(normalise(code)).toContain('Object.assign(__el0.style,')
    expect(code).not.toContain('effect(')
  })

  it('wraps reactive style object in effect()', () => {
    const code = compileJsx(`
      function C() {
        const styles = signal({ color: 'blue' })
        return <div style={() => styles()}></div>
      }
    `)
    expect(code).toContain('effect(')
    expect(normalise(code)).toContain('Object.assign(__el0.style,')
  })
})
