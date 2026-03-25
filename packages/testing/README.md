# @stewie-js/testing

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

Test utilities for Stewie applications. Provides `mount` for rendering components into a real DOM (via jsdom or happy-dom), DOM query helpers, signal and store assertions, and an SSR helper for snapshot testing.

Designed for use with [Vitest](https://vitest.dev/).

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add -D @stewie-js/testing
```

## Mounting components

```ts
// my-component.test.ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@stewie-js/testing'
import { jsx, signal, createRoot } from '@stewie-js/core'

describe('Counter', () => {
  it('increments when clicked', () => {
    let count: ReturnType<typeof signal<number>>
    createRoot(() => { count = signal(0) })

    const result = mount(
      jsx('div', { children: () => String(count()) })
    )

    expect(result.getByTestId('count').textContent).toBe('0')
    count.set(1)
    expect(result.getByTestId('count').textContent).toBe('1')

    result.unmount()
  })
})
```

## DOM queries

```ts
const result = mount(jsx(MyComponent, {}))

result.getByText('Submit')          // throws if not found
result.queryByText('Submit')        // returns null if not found
result.getByTestId('submit-btn')    // finds by data-testid
result.getByRole('button')          // finds by ARIA role
await result.findByText('Loaded')   // waits for async appearance

result.container   // the root HTMLElement
result.html        // container.innerHTML
result.unmount()   // clean up
```

## Signal and store assertions

```ts
import { assertSignal, assertStore } from '@stewie-js/testing'
import { signal, store, createRoot } from '@stewie-js/core'

createRoot(() => {
  const count = signal(42)
  assertSignal(count, 42)   // passes
  assertSignal(count, 0)    // throws

  const state = store({ user: { name: 'Alice' } })
  assertStore(state, 'user.name', 'Alice')  // passes
  assertStore(state, 'user.name', 'Bob')    // throws
})
```

## SSR snapshot testing

```ts
import { renderToString } from '@stewie-js/testing'
import { jsx } from '@stewie-js/core'

const { html } = await renderToString(jsx(MyComponent, {}))
expect(html).toContain('<h1>Hello</h1>')
```

## Context injection

```ts
import { mount, withContext } from '@stewie-js/testing'

const ThemeCtx = createContext('light')

// Inject a context value into a mounted tree
const result = mount(jsx(MyComponent, {}), {
  contexts: [{ context: ThemeCtx, value: 'dark' }],
})

// Or run a callback with a context value
withContext(ThemeCtx, 'dark', () => {
  const theme = inject(ThemeCtx) // 'dark'
})
```

## API

| Export | Description |
|---|---|
| `mount(element, options?)` | Render a JSX element into a detached DOM node |
| `MountResult` | Type returned by `mount` — includes query helpers and `unmount()` |
| `assertSignal(sig, expected)` | Assert a signal's current value |
| `assertStore(store, path, expected)` | Assert a store property by dot-path |
| `flushEffects()` | Returns a promise that resolves after pending reactive effects settle |
| `renderToString(element)` | SSR helper — returns `{ html, stateScript }` |
| `withContext(ctx, value, fn)` | Run `fn` with a context value provided |
