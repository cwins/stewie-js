# Stewie Diagnostics — Discovery Inventory

> **Status:** Planning document (roadmap item 18). Not user-facing docs. This file enumerates every likely dev mistake that Stewie's compiler or dev runtime should catch, with a stable code, detection path, and proposed message. Implementation is a future roadmap phase; this doc is the inventory the implementation plan builds from.

## Conventions

- **Code:** `STWxxx`. Reserved ranges by category so adjacent numbers group naturally.
- **Detection:**
  - **compiler-static** — detectable from syntax alone. Runs in `@stewie-js/compiler` without type info. Works in plain JS.
  - **compiler-type-aware** — requires a `ts.TypeChecker` (like the existing auto-wrap logic). Only runs when TS types are available.
  - **dev-runtime** — requires execution context. Runs in dev builds only; stripped in prod.
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
**Detection:** compiler-static · **Severity:** error

```tsx
// Bad — side effect inside a pure computation
const doubled = computed(() => {
  $count.set(10);
  return $count() * 2;
});
```

**Message:** `Signal '{name}' written inside a computed() body. Computeds must be pure. Move the write to an event handler, effect(), or an action.`

### STW044 — Signal read inside `untrack()` with no surrounding reactive context
**Detection:** compiler-static · **Severity:** warn

Using `untrack()` at module scope or outside any reactive scope is almost always a mistake.

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
- **Priorities:** start with the ones that caught real bugs already — STW001–004 (module-scope primitives), STW010–011 (uncalled signals in JSX), STW020–021 (non-function `when`/`each`), STW030 (static prop reads of accessors). These cover the majority of real mistakes observed so far.
