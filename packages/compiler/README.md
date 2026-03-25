# @stewie-js/compiler

> **Work in progress.** APIs may change between releases.

TSX compiler for Stewie. Transforms `.tsx` source files into fine-grained reactive output — JSX attribute expressions that are functions become direct DOM effect subscriptions, and static expressions are set once with no subscription overhead.

This package is used internally by `@stewie-js/vite`. You only need it directly if you're building a custom build tool integration.

Part of the [Stewie](https://github.com/cwins/stewie-js) framework.

## Install

```bash
pnpm add -D @stewie-js/compiler
```

## What it does

Given a component like:

```tsx
function Card({ title, active }: { title: string; active: () => boolean }) {
  return <div class={active() ? 'active' : ''} id="card">{title}</div>
}
```

The compiler identifies:
- `active() ? 'active' : ''` — reactive (calls a signal/function), wraps in `effect()`
- `"card"` — static, sets the attribute once
- `title` — static prop, sets the text node once

And emits optimized DOM code with fine-grained subscriptions only where needed.

## `$prop` two-way binding

The compiler expands `$value={sig}` into a value binding plus the corresponding input event handler:

```tsx
// Input:
<input $value={username} />

// Output equivalent:
<input value={username()} onInput={e => username.set(e.target.value)} />
```

## Validation

The compiler emits hard errors for:
- `signal()` / `store()` / `effect()` called at module scope (must be inside a component or `createRoot`)
- Conflicting `$prop` bindings (e.g. `$value` and `value` on the same element)

And warnings for:
- `$value` on a `readonly` or `disabled` input (downgraded to one-way binding)

## Programmatic API

```ts
import { transformFile, analyzeFile, validateFile } from '@stewie-js/compiler'

const result = transformFile('src/App.tsx', sourceCode, { jsxToDom: false })

if (result.diagnostics.some(d => d.severity === 'error')) {
  for (const d of result.diagnostics) {
    console.error(`${d.file}:${d.line} — ${d.message}`)
  }
} else {
  console.log(result.code)
  console.log(result.sourceMap)
}
```

## API

| Export | Description |
|---|---|
| `transformFile(filename, source, options?)` | Full compile pipeline — returns `{ code, sourceMap, diagnostics }` |
| `parseFile(filename, source)` | Parse TSX to AST |
| `analyzeFile(parsed)` | Identify reactive attributes, `$prop` bindings, module-scope calls |
| `validateFile(analysis)` | Produce diagnostics for rule violations |
| `CompileOptions` | Options type for `transformFile` |
| `CompileResult` | Return type of `transformFile` |
| `CompilerDiagnostic` | A single diagnostic message with severity, file, and line |
