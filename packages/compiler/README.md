# @stewie-js/compiler

>❗ **Work in progress.**
>
>Stewie is under active development and not yet stable. APIs may change between releases. Not recommended for production use yet.

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
- `signal()` / `store()` / `effect()` called at module scope (must be inside a component or `reactiveScope`)
- Conflicting `$prop` bindings (e.g. `$value` and `value` on the same element)

And warnings for:
- `$value` on a `readonly` or `disabled` input (downgraded to one-way binding)

## Programmatic API

`compile()` is the primary public API. It runs the full pipeline in one call.

```ts
import { compile } from '@stewie-js/compiler'

const result = compile(sourceCode, { filename: 'src/App.tsx' })

if (result.errors.length > 0) {
  for (const err of result.errors) {
    console.error(`${err.file}:${err.line}:${err.column} — ${err.message}`)
  }
} else {
  console.log(result.code)
  if (result.map) console.log(result.map)
}
```

The `CompileResult` shape:

```ts
interface CompileResult {
  code: string                   // transformed source (original source if there are errors)
  map: string | undefined        // source map JSON (if sourcemap option is enabled)
  diagnostics: CompilerDiagnostic[]  // all diagnostics (errors + warnings)
  errors: CompilerDiagnostic[]   // hard errors only
  warnings: CompilerDiagnostic[] // warnings only
}
```

### Lower-level building blocks

```ts
import { parseFile, analyzeFile, validateFile, transformFile } from '@stewie-js/compiler'

const parsed   = parseFile(source, filename)
const analysis = analyzeFile(parsed)
const diags    = validateFile(parsed, analysis)
const code     = transformFile(parsed, analysis, { jsxToDom: true })
```

## API

| Export | Description |
|---|---|
| `compile(source, options)` | Full compile pipeline — returns `CompileResult` |
| `parseFile(source, filename)` | Parse TSX to AST (`ParsedFile`) |
| `analyzeFile(parsed)` | Identify reactive attributes, `$prop` bindings, module-scope calls |
| `validateFile(parsed, analysis)` | Produce `CompilerDiagnostic[]` for rule violations |
| `transformFile(parsed, analysis, options?)` | Emit transformed source string |
| `CompileOptions` | Options type for `compile` |
| `CompileResult` | Return type of `compile` |
| `CompilerDiagnostic` | A single diagnostic with `severity`, `file`, `line`, `column`, and `message` |
