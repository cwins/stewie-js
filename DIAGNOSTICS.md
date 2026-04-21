# Stewie Diagnostics — Discovery Inventory

> **Status:** Planning document (roadmap item 18). Not user-facing docs. This file enumerates every likely dev mistake that Stewie's compiler or dev runtime should catch, with a stable code, detection path, and proposed message. Implementation is a future roadmap phase; this doc is the inventory the implementation plan builds from.

## Conventions

- **Code:** `STWxxx`. Reserved ranges by category so adjacent numbers group naturally.
- **Detection:**
  - **compiler-static** — detectable from syntax alone. Runs in `@stewie-js/compiler` without type info. Works in plain JS.
  - **compiler-type-aware** — requires a `ts.TypeChecker` (like the existing auto-wrap logic). Only runs when TS types are available.
  - **dev-runtime** — requires execution context. Runs in dev builds only; stripped in prod.
  - **Dual detection:** Stewie's compiler is optional — projects using plain JSX via `jsxImportSource` get no compiler diagnostics. Where feasible, a rule should ship in both a compiler path AND a dev-runtime path so the safety net exists either way. Each entry tags `**Dual:** yes | no | n/a` to say whether a secondary path is viable. `n/a` means only one path is technically possible (e.g., hydration mismatches can't be caught statically; `$prop` conflicts can't be caught at runtime because the compiler has already erased one side).
- **Severity:** `error` stops the build or throws; `warn` logs and continues.
- Each entry has a single **message** proposal. Messages lead with what went wrong, include the identifier when possible, and suggest the fix.

## Table of contents

- [Module-scope reactivity (STW001–009)](#module-scope-reactivity)
- [Signal usage in JSX (STW010–019)](#signal-usage-in-jsx)
- [Control flow (STW020–029)](#control-flow)
- [Component props and composition (STW030–039)](#component-props-and-composition)
- [Reactive scope and lifecycle (STW040–049)](#reactive-scope-and-lifecycle)
- [Context (STW050–059)](#context)
- [Resource (STW060–069)](#resource)
- [Router (STW070–079)](#router)
- [SSR and hydration (STW080–089)](#ssr-and-hydration)
- [Compiler transforms (STW090–099)](#compiler-transforms)
- [Testing (STW100–109)](#testing)

---

## Module-scope reactivity

Stewie requires all reactive primitives to be created inside a component or `reactiveScope()`. Module-scope creation leaks request state across SSR renders.

### STW001 — `signal()` called at module scope
**Detection:** compiler-static · **Severity:** error

```ts
// Bad — at module scope
const $count = signal(0);

export function Counter() { ... }
```

**Message:** `signal() called at module scope. Reactive primitives must be created inside a component or reactiveScope() — module-scope signals leak state across SSR requests. Move the signal() call inside Counter().`

### STW002 — `computed()` called at module scope
**Detection:** compiler-static · **Severity:** error

Same shape as STW001 with `computed`.

**Message:** `computed() called at module scope. Move inside a component or reactiveScope().`

### STW003 — `store()` called at module scope
**Detection:** compiler-static · **Severity:** error

Same shape as STW001 with `store`.

**Message:** `store() called at module scope. Move inside a component or reactiveScope().`

### STW004 — `effect()` called at module scope
**Detection:** compiler-static · **Severity:** error

**Message:** `effect() called at module scope. Effects must be owned by a component or reactiveScope() so they can be disposed.`

---

## Signal usage in JSX

### STW010 — Signal referenced but not called in JSX text child
**Detection:** compiler-type-aware · **Severity:** error

```tsx
// Bad — $name is Signal<string>, rendered as the function itself
<span>{$name}</span>

// Good
<span>{$name()}</span>
// Or: function child
<span>{() => $name()}</span>
```

**Message:** `Signal '{name}' was referenced but not called. JSX will render the function value, not the signal's current value. Did you mean '{name}()'?`

### STW011 — Signal referenced but not called in a JSX attribute
**Detection:** compiler-type-aware · **Severity:** error

```tsx
// Bad
<input value={$name} />

// Good
<input value={$name()} />
```

**Message:** `Signal '{name}' passed as the value of attribute '{attr}' instead of its current value. Did you mean '{name}()'?`

### STW012 — Reactive read in a static attribute expression
**Detection:** compiler-type-aware · **Severity:** warn

Signal read inside a JSX attribute expression that is not wrapped in `() =>` and which the compiler cannot auto-wrap (complex expressions, template literals with multiple reads). The attribute will not update when the signal changes.

```tsx
// Bad — class string is evaluated once at mount
<div class={`box box-${$theme()}`} />

// Good
<div class={() => `box box-${$theme()}`} />
```

**Message:** `Attribute '{attr}' reads signal '{name}' but is not wrapped as a function. The attribute will not update when the signal changes. Wrap in '() => ...' to make it reactive.`

### STW013 — Non-signal function passed where a value is expected
**Detection:** compiler-type-aware · **Severity:** warn

```tsx
const getLabel = () => 'Save';  // plain fn, not a signal
<button>{getLabel}</button>     // renders the function
```

**Message:** `A function is being rendered as JSX children. If this is reactive, call it ('{name}()') or wrap children as '() => {name}()'. If it's a component, use <{name} /> syntax.`

### STW014 — `signal.peek()` used in a reactive context
**Detection:** compiler-static · **Severity:** warn

```tsx
// Bad — peek() escapes tracking
<span>{() => $count.peek()}</span>
```

**Message:** `signal.peek() reads without subscribing. The surrounding reactive expression will not re-run when '{name}' changes. Use '{name}()' if you want reactivity, or move the peek() out of the reactive context.`

---

## Control flow

### STW020 — `Show` `when` prop is a non-function
**Detection:** compiler-type-aware · **Severity:** error

```tsx
// Bad — value evaluated once at mount
<Show when={$isOpen()}>...</Show>

// Good
<Show when={$isOpen}>...</Show>
<Show when={() => $isOpen()}>...</Show>
```

**Message:** `<Show when> received a value instead of a signal or function. The condition will not re-evaluate. Pass the signal directly ('when={{$isOpen}}') or wrap as '() => $isOpen()'.`

### STW021 — `For` `each` prop is a non-function
**Detection:** compiler-type-aware · **Severity:** error

```tsx
// Bad
<For each={$tasks()} by={(t) => t.id}>{...}</For>

// Good
<For each={$tasks} by={(t) => t.id}>{...}</For>
```

**Message:** `<For each> received an array instead of a signal or function. The list will not react to changes. Pass the signal directly ('each={{$tasks}}') or wrap as '() => $tasks()'.`

### STW022 — `For` `by` key function likely returns non-unique keys
**Detection:** compiler-static · **Severity:** warn

Detect patterns like `by={() => 'x'}`, `by={() => 0}`, or `by={(_) => _}` when `_` is not obviously a unique field. Also warn if `by` is omitted for object arrays (should produce a separate info-level hint).

**Message:** `<For by> key function appears to return the same value for every item ('{pattern}'). Keys must be unique for keyed reconciliation. Return a unique identifier per item (e.g., 'by={{(item) => item.id}}').`

### STW023 — `Switch` with no matching `Match` and no default child
**Detection:** dev-runtime · **Severity:** warn

```tsx
// At runtime if no Match claims the value and no default children
<Switch value={$status}>
  <Match when="a">...</Match>
  <Match when="b">...</Match>
</Switch>
```

**Message:** `<Switch value='{value}'> rendered with no matching <Match>. Add a fallback (default children) or a <Match when> for this case.`

### STW024 — `Portal` target selector returned no element
**Detection:** dev-runtime · **Severity:** warn

**Message:** `<Portal to='{selector}'> could not find a target element. The portal's children will not render. Check that the target exists before the portal mounts.`

---

## Component props and composition

This is the category that caught us in Work Queue — static prop destructuring when the parent passes an accessor.

### STW030 — Component destructures a prop and reads fields non-reactively
**Detection:** compiler-type-aware · **Severity:** warn

When a component destructures a prop whose type is `T | (() => T)` or an accessor function, and then reads a field of it non-reactively inside the JSX body.

```tsx
// Bad — reads are static even though parent may update the accessor
function TaskRow({ task }: { task: () => Task }) {
  return <span>{task().title}</span>;  // not reactive
}

// Good
function TaskRow({ task }: { task: () => Task }) {
  return <span>{() => task().title}</span>;
}
```

**Message:** `Prop '{name}' is an accessor ({signature}) but field '{field}' is read non-reactively. The rendered value will not update when the parent's signal changes. Wrap as '() => {name}().{field}' or make '{name}' a plain value if reactivity is not needed here.`

### STW031 — Signal passed to a prop typed as a plain value
**Detection:** compiler-type-aware · **Severity:** error

```tsx
// Bad — parent passes a Signal<string>, child prop is string
<Label text={$name} />
```

**Message:** `Signal '{name}' passed to prop '{prop}' which expects '{expectedType}'. Either call the signal ('{name}()'), change the prop type to accept '() => {expectedType}', or rewrite the consumer to read reactively.`

### STW032 — Component function returns a function instead of a node
**Detection:** compiler-type-aware · **Severity:** warn

```tsx
// Bad — looks like lazy/memo pattern but isn't
function MyList() {
  return () => <ul>...</ul>;
}
```

**Message:** `Component '{name}' returns a function instead of a JSX element. Did you mean to return the JSX directly, or wrap the body in a lazy()/For/Show primitive?`

---

## Reactive scope and lifecycle

### STW040 — `signal()` created inside an `effect()` body
**Detection:** compiler-static · **Severity:** error

```tsx
// Bad — creates a new signal every time the effect runs
effect(() => {
  const $count = signal(0);
  console.log($count());
});
```

**Message:** `signal() created inside an effect() body. This creates a new signal on every effect run, leaking state. Hoist the signal() call outside the effect.`

### STW041 — `onCleanup()` called outside a reactive scope
**Detection:** dev-runtime · **Severity:** warn

**Message:** `onCleanup() called with no owning scope. The cleanup will never run. Call onCleanup() inside a component, effect, or reactiveScope().`

### STW042 — `effect()` created inside a `computed()` body
**Detection:** compiler-static · **Severity:** error

```tsx
// Bad — effects inside computeds leak
const doubled = computed(() => {
  effect(() => console.log($count()));
  return $count() * 2;
});
```

**Message:** `effect() created inside a computed(). Computeds must be pure — effects created here will not be cleaned up correctly. Move the effect to a component body or reactiveScope().`

### STW043 — Writing to a signal inside a `computed()` body
**Detection:** compiler-type-aware · **Severity:** error

> Promoted from compiler-static: `sig.set(x)` and `map.set(k, v)` are indistinguishable without type info, so the receiver must be verified as a `Signal<T>` via the `ts.TypeChecker`. Lands in phase 2.

```tsx
// Bad — side effect inside a pure computation
const doubled = computed(() => {
  $count.set(10);
  return $count() * 2;
});
```

**Message:** `Signal '{name}' written inside a computed() body. Computeds must be pure. Move the write to an event handler, effect(), or an action.`

### STW044 — Signal read inside `untrack()` with no surrounding reactive context
**Detection:** dev-runtime · **Severity:** warn

> Moved to dev-runtime: static detection can't tell which functions will run as components at call time. The runtime knows whether the active scope is reactive and can warn precisely.

**Message:** `untrack() used outside a reactive context. untrack() is only meaningful when wrapped by a reactive scope (effect, computed, component). Here it is a no-op.`

---

## Context

### STW050 — `consume(Context)` with no ancestor `provide`
**Detection:** dev-runtime · **Severity:** error

**Message:** `consume({name}) found no ancestor provide({name}, ...). Either wrap the consumer in a provider or supply a default value when creating the context.`

### STW051 — `consume()` called outside a reactive scope
**Detection:** dev-runtime · **Severity:** warn

**Message:** `consume() called outside a component or reactiveScope(). Context values cannot be resolved here.`

### STW052 — `createContext()` called inside a component
**Detection:** compiler-static · **Severity:** warn

```tsx
// Bad — new context per render, providers/consumers won't match
function App() {
  const ThemeContext = createContext('light');
  ...
}

// Good — at module scope
const ThemeContext = createContext('light');
```

**Message:** `createContext() called inside a component. This creates a new context identity per render, so provide/consume calls will not match. Move createContext() to module scope.`

---

## Resource

### STW060 — `resource()` fetcher does not accept its `AbortSignal`
**Detection:** compiler-type-aware · **Severity:** warn

```tsx
// Bad — fetcher doesn't receive/pass AbortSignal
const user = resource($userId, (id) => fetch(`/users/${id}`).then(r => r.json()));

// Good
const user = resource($userId, (id, { signal }) =>
  fetch(`/users/${id}`, { signal }).then(r => r.json())
);
```

**Message:** `resource() fetcher does not accept its AbortSignal. Stale requests will not be cancelled when inputs change or the scope is disposed. Accept the second argument and pass 'signal' to fetch (or an equivalent).`

### STW061 — `resource()` input function has no reactive dependencies
**Detection:** compiler-type-aware · **Severity:** warn

```tsx
// Bad — input never changes, resource only runs once
const data = resource(() => 'static', (k) => fetch(`/api/${k}`));
```

**Message:** `resource() input function reads no signals. The fetcher will only run once. If this is intentional, prefer an effect() or a direct fetch. If not, the input should read at least one signal that should trigger refetch.`

### STW062 — Resource value read without loading check outside `Suspense`
**Detection:** compiler-type-aware · **Severity:** warn

```tsx
// Bad — user() can be undefined during load
<span>{() => user().name}</span>
```

**Message:** `Resource '{name}' is read without a loading guard and is not inside a <Suspense> boundary. The value may be undefined during load and after an error. Use <Suspense>, check user.loading(), or use user.read() to throw into Suspense.`

---

## Router

### STW070 — Route `load` returns a signal
**Detection:** compiler-type-aware · **Severity:** warn

```ts
// Bad — loader should return resolved data, not a signal
export const load = () => signal(42);
```

**Message:** `Route load() returned a signal. Loaders should return resolved data (or a Promise of it). Reactive state belongs inside the route component, not in the loader's return value.`

### STW071 — Route `beforeEnter` returns `undefined`
**Detection:** compiler-type-aware · **Severity:** warn

Guards must return a boolean, a redirect descriptor, or explicitly `true`/`false`. Falling through without a return is ambiguous.

**Message:** `beforeEnter for route '{path}' returned undefined. Return true to allow, false to block, or a redirect descriptor ({{ redirect: '/login' }}) to redirect.`

### STW072 — `useParams()` / `useQuery()` / `useRouteData()` called outside a routed component
**Detection:** dev-runtime · **Severity:** warn

**Message:** `{fn}() called outside an active router. The return value is empty. Ensure the component is rendered inside <Router>.`

### STW073 — `<Link to>` is an external URL
**Detection:** compiler-static · **Severity:** warn

```tsx
// Bad — Link is for internal navigation
<Link to="https://example.com">Docs</Link>
```

**Message:** `<Link to='{url}'> appears to be an external URL. <Link> is for internal client-side navigation. Use a plain <a href='{url}' rel='noopener'> for external links.`

### STW074 — `navigate()` called during render
**Detection:** dev-runtime · **Severity:** error

**Message:** `navigate() called during a component render. Navigation must happen in event handlers, effects, or loaders — not synchronously during render.`

---

## SSR and hydration

### STW080 — Hydration mismatch: text content
**Detection:** dev-runtime · **Severity:** warn

**Message:** `Hydration mismatch at {path}: server rendered '{server}', client expected '{client}'. Ensure both environments produce the same output for a given input. Common causes: Date.now(), Math.random(), or browser-only APIs inside render.`

### STW081 — Hydration mismatch: attribute value
**Detection:** dev-runtime · **Severity:** warn

**Message:** `Hydration mismatch on {element} attribute '{attr}': server='{server}' client='{client}'.`

### STW082 — Hydration mismatch: structural
**Detection:** dev-runtime · **Severity:** error

**Message:** `Hydration mismatch at {path}: server DOM has {serverCount} children, client expected {clientCount}. This usually means a conditional rendered differently between server and client. Wrap client-only content in <ClientOnly>.`

### STW083 — `window` / `document` accessed at module scope
**Detection:** compiler-static · **Severity:** error (in `packages/core`, `packages/server`), warn elsewhere

**Message:** `Browser global '{name}' accessed at module scope. The module will fail to load on the server. Move the access inside a component or guard with 'typeof window !== "undefined"'.`

### STW084 — Browser-only API called during SSR render
**Detection:** dev-runtime · **Severity:** error

**Message:** `Browser API '{name}' called during SSR. This code will throw on the server. Wrap in <ClientOnly> or an effect (which only runs on the client).`

### STW085 — `useTitle` / `useMeta` (future) called with a non-serializable value
**Detection:** dev-runtime · **Severity:** warn

Pending item 22 (head/metadata primitives). Placeholder for now.

---

## Compiler transforms

### STW090 — `$prop` binding on a non-signal target
**Detection:** compiler-type-aware · **Severity:** error

```tsx
// Bad — $value expects a Signal
const name = 'static';
<input $value={name} />
```

**Message:** `$value binding requires a Signal target. '{name}' is a '{type}'. Use 'signal()' to create a writable signal.`

### STW091 — `$prop` binding on a read-only (`computed`) target
**Detection:** compiler-type-aware · **Severity:** error

```tsx
// Bad — can't write to a computed
const $upper = computed(() => $name().toUpperCase());
<input $value={$upper} />
```

**Message:** `$value binding requires a writable signal. '{name}' is a computed (read-only). Two-way binding cannot write back.`

### STW092 — Both `$prop` and `prop` specified
**Detection:** compiler-static · **Severity:** error

```tsx
// Bad — conflict
<input value="a" $value={$name} />
```

**Message:** `<input> has both 'value' and '$value' attributes. $value is the two-way binding and implies the value. Remove the plain 'value' attribute.`

### STW093 — `$prop` binding on an attribute with no matching event
**Detection:** compiler-static · **Severity:** error

Two-way binding maps known attribute/event pairs (`value`/`input`, `checked`/`change`). Unknown pairs are probably a mistake.

**Message:** `'$ {attr}' is not a recognized two-way binding. Known pairs: $value (input/textarea), $checked (checkbox/radio). For custom two-way data flow, read the signal and write in an event handler explicitly.`

### STW094 — `$prop` binding on a `readonly` element
**Detection:** compiler-static · **Severity:** warn

**Message:** `$${prop} on readonly element will be downgraded to one-way binding.`

### STW095 — `$prop` binding on a `disabled` element
**Detection:** compiler-static · **Severity:** warn

**Message:** `$${prop} on disabled element will be downgraded to one-way binding.`

---

## Testing

### STW100 — `mount()` called on the server
**Detection:** dev-runtime · **Severity:** error

**Message:** `mount() called during SSR. Use renderToString() or renderToStream() on the server. mount() is for client-side rendering only.`

### STW101 — Signal assertion on a non-signal value
**Detection:** compiler-type-aware · **Severity:** warn

```ts
expect(value).toBeSignal();  // value is a plain number
```

**Message:** `{assertion} expects a Signal but received '{type}'. Did you forget to pass the signal itself instead of its current value (e.g., 'signal' instead of 'signal()')?`

---

## Notes on implementation

- **Numeric ranges** leave gaps for expansion inside each category (e.g., STW005–009 reserved for future module-scope rules).
- **Compiler vs runtime split** matters for deliverability. Compiler rules can block the build at develop time with great DX. Runtime rules are only active in dev and must not ship in prod — wrap in `if (process.env.NODE_ENV !== 'production')` or equivalent edge guard.
- **Silencing:** each rule should accept `// stewie-ignore STW030` (line-scoped) and `// stewie-ignore STW030 -- reason` to capture intent.
- **Docs:** each diagnostic code needs a docs page explaining the rule, the fix, and the rationale. Pattern: URL like `https://stewie.dev/diagnostics/STW030` embedded in the message when docs exist.

---

## Phase plan

Each phase is self-contained and ships the relevant cross-cutting infra with it. The `Dual` column names the secondary path when available.

### Cross-cutting infra (lands with phase 1)

- Diagnostic record type: `{ code, severity, message, loc, docsUrl }`
- `// stewie-ignore STWxxx -- reason` comment directive, line-scoped, understood by both compiler and dev-runtime
- Fixture-based test harness for compiler diagnostics in `packages/compiler`
- Dev-runtime logger in `packages/core` guarded by `process.env.NODE_ENV !== 'production'` / edge equivalent, with a single emit path so rules don't each reinvent formatting

### Phase 1 — compiler-static + runtime parity for existing checks

Cheap wins. Most of these already exist as informal runtime warnings; phase 1 formalizes them with stable codes and adds the compiler-static counterpart.

| Code | Rule | Primary | Dual |
|---|---|---|---|
| STW001–004 | Module-scope `signal`/`computed`/`store`/`effect` | compiler-static | dev-runtime (already exists informally) |
| STW014 | `signal.peek()` in a reactive context | compiler-static | no (can't distinguish from intentional peek at runtime) |
| STW022 | `<For by>` returns non-unique keys | compiler-static | dev-runtime (sample keys on render) |
| STW040 | `signal()` inside `effect()` body | compiler-static | dev-runtime |
| STW042 | `effect()` inside `computed()` body | compiler-static | dev-runtime |
| STW052 | `createContext()` inside a component | compiler-static | dev-runtime |
| STW073 | `<Link to>` is an external URL | compiler-static | dev-runtime (check at navigation time) |
| STW083 | `window`/`document` at module scope | compiler-static | dev-runtime (SSR import-time throw) |
| STW092 | Both `$prop` and `prop` specified | compiler-static | n/a (compiler erases one side) |
| STW094 | `$prop` on a readonly element | compiler-static | n/a |
| STW095 | `$prop` on a disabled element | compiler-static | n/a |

### Phase 2 — compiler-type-aware (highest user value)

Piggybacks on the `ts.Program` already created for auto-wrap. These are where real-world mistakes cluster.

| Code | Rule | Primary | Dual |
|---|---|---|---|
| STW010 | Uncalled signal in JSX text child | compiler-type-aware | n/a (compiler already rewrote reads) |
| STW011 | Uncalled signal in JSX attribute | compiler-type-aware | n/a |
| STW012 | Reactive read in a static attribute expression | compiler-type-aware | no |
| STW013 | Non-signal function rendered as child | compiler-type-aware | dev-runtime (runtime catches any function, regardless of type — broader than the compiler rule) |
| STW020 | `<Show when>` is a non-function | compiler-type-aware | dev-runtime |
| STW021 | `<For each>` is a non-function | compiler-type-aware | dev-runtime |
| STW030 | Accessor prop field read non-reactively | compiler-type-aware | n/a |
| STW031 | Signal passed to plain-value prop | compiler-type-aware | no (signals are recognizable at runtime, but message quality is strictly worse) |
| STW043 | Signal write inside `computed()` body | compiler-type-aware | dev-runtime |
| STW032 | Component function returns a function | compiler-type-aware | dev-runtime |
| STW090 | `$prop` on non-signal target | compiler-type-aware | n/a |
| STW091 | `$prop` on read-only (computed) target | compiler-type-aware | n/a |

### Phase 3 — dev-runtime only

No static equivalent; these require execution context.

| Code | Rule |
|---|---|
| STW023 | `<Switch>` with no matching `<Match>` and no default |
| STW024 | `<Portal to>` target not found |
| STW041 | `onCleanup()` outside a reactive scope |
| STW044 | `untrack()` outside a reactive context |
| STW050 | `consume()` with no ancestor `provide` |
| STW051 | `consume()` outside a reactive scope |
| STW072 | `useParams`/`useQuery`/`useRouteData` outside a router |
| STW074 | `navigate()` during render |
| STW080–082 | Hydration mismatches (text, attribute, structural) |
| STW084 | Browser-only API during SSR render |

### Deferred

Blocked on features that don't exist yet or aren't stable:

- STW060–062 — resource(): wait until resource API is stable and the Suspense-loading-check rule has real usage data
- STW070–071 — router loader/guard shape: stable but low-frequency; revisit after phase 2
- STW085 — head/meta primitives: blocked on roadmap item 22
- STW100–101 — testing matchers: blocked on `@stewie-js/testing` adding a signal-aware matcher surface

### Priorities within each phase

Start with the rules that have already caught real bugs in this repo or the Work Queue app:
- Phase 1: STW001–004 (module-scope), STW043 (write in computed)
- Phase 2: STW030 (the Work Queue accessor bug), STW010/011 (most common JSX mistake), STW020/021 (keyed-list/conditional footguns)
- Phase 3: STW080–082 (hydration) is the highest-leverage runtime rule; everything else is opportunistic
