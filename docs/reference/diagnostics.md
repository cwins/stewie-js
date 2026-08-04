# Diagnostics

Stewie emits diagnostics with stable `STW###` codes to catch common mistakes early. Compiler diagnostics surface at build time (and in your editor via the Vite plugin); a few dev-runtime warnings catch things that only show up when code runs. Each message links back to this page.

The compiler is optional — projects using plain JSX without `@stewie-js/vite` still get the dev-runtime warnings, but not the build-time ones. Where a rule can run in both places it does.

::: tip
These are guidance, not gates. Most are warnings. They point at a footgun and suggest the fix; the entry here explains *why*.
:::

## Module-scope reactivity

### STW001 — `signal()` at module scope {#stw001}

Creating a `signal()` (or `computed`/`store`/`effect`) at module scope makes it an accidental singleton shared across every SSR request. Move the call inside a component body or `reactiveScope()`.

### STW002 — `computed()` at module scope {#stw002}

Same as [STW001](#stw001): a module-scope `computed()` is shared across requests. Create it inside a component or `reactiveScope()`.

### STW003 — `store()` at module scope {#stw003}

A module-scope `store()` leaks state across SSR requests. Create it inside a component or `reactiveScope()`.

### STW004 — `effect()` at module scope {#stw004}

Effects must be owned by a component or `reactiveScope()` so they can be disposed. A module-scope effect is never cleaned up.

### STW005 — `useAction()` outside a component or `reactiveScope()` {#stw005}

`useAction()` creates per-call-site `pending`/`error` signals that need an owning scope. Call it inside a component body or `reactiveScope()`. (`defineAction()` at module scope is fine — it creates no signals.)

### STW006 — `useResource()` outside a component or `reactiveScope()` {#stw006}

`useResource()` creates per-call-site `data`/`loading`/`error` signals that need an owning scope. Call it inside a component or `reactiveScope()`. (`defineResource()` at module scope is fine.)

### STW007 — `useTitle()` / `useMeta()` outside a component or `reactiveScope()` {#stw007}

These create reactive effects that write `document.head` and must be disposed on unmount. Call them inside a component or `reactiveScope()`.

## Signals in JSX

### STW010 — Signal referenced but not called in a JSX child {#stw010}

`{count}` renders the function itself, not its value. Call it: `{count()}`, or wrap as a function child `{() => count()}` for a reactive slot.

### STW011 — Signal referenced but not called in a JSX attribute {#stw011}

`attr={sig}` sets the attribute to the function. Call it: `attr={sig()}` (static read) or `attr={() => sig()}` (reactive).

### STW014 — `peek()` inside a reactive context {#stw014}

`peek()` reads without subscribing, so an `effect()`/`computed()` that only `peek()`s a signal won't re-run when it changes. Call the signal directly (`sig()`) for reactivity, or move the `peek()` outside the reactive body if the non-tracking read is intentional.

## Control flow

### STW020 — `<Show when>` given an eager signal read {#stw020}

`when={isOpen()}` reads the signal once at mount, so the condition never re-evaluates. Pass the signal directly (`when={isOpen}`) or wrap it (`when={() => isOpen()}`). Only genuine `Signal`/`Computed` reads are flagged — a static helper call isn't.

### STW021 — `<For each>` given an eager signal read {#stw021}

`each={tasks()}` reads the signal once at mount, so the list never reacts to changes. Pass the signal directly (`each={tasks}`) or wrap it (`each={() => tasks()}`).

### STW022 — `<For by>` returns a non-unique key {#stw022}

A `by` key function returning a constant or the identity of its parameter breaks keyed reconciliation — rows collapse or re-render incorrectly. Return a per-item unique id: `by={(item) => item.id}`.

## Reactive scope and lifecycle

### STW040 — `signal()` created inside an `effect()` body {#stw040}

The signal is re-created on every effect run, so its state resets each time and nothing outside the effect can read it. Hoist the `signal()` call above the `effect()`.

### STW042 — `effect()` created inside a `computed()` body {#stw042}

Computeds must be pure. An effect created here is never cleaned up and can loop when the computed re-evaluates. Move the effect to a component body or `reactiveScope()`.

## Context

### STW052 — `createContext()` called outside module scope {#stw052}

Each `createContext()` call creates a new context identity, so `provide()`/`consume()` pairs across renders won't match. Move `createContext()` to module top level.

## Resource

### STW063 — `defineResource()` without a stable `id` used with SSR replay {#stw063}

Without an explicit `{ id }`, an auto-counter id is assigned that is not stable across the separate SSR and client builds. To stay safe, an unkeyed resource does not participate in the `DataRegistry` at all — its SSR-resolved data is refetched on the client and it won't dedupe across components. Pass an explicit id for SSR replay: `defineResource(fn, { id: 'fetchUser' })`.

## Router

### STW073 — `<Link to>` is an external URL {#stw073}

`<Link>` is for internal client-side navigation. An `http(s)://` target should be a plain `<a href rel="noopener noreferrer">`.

## SSR / hydration

### STW083 — `window` / `document` accessed at module scope {#stw083}

The module throws on import in SSR / non-browser environments. Move the access inside a component or `effect()`, or guard with `typeof window !== 'undefined'`.

## Two-way binding (`$prop`)

### STW092 — Both `$prop` and `prop` specified {#stw092}

`$value` already implies `value`. Having both is contradictory — remove the plain `value` attribute.

### STW094 — `$prop` on a `readonly` element {#stw094}

A two-way binding on a `readonly` element can't write back, so it's downgraded to one-way. Drop `readonly`, or use a plain one-way `value={...}`.

### STW095 — `$prop` on a `disabled` element {#stw095}

Same as [STW094](#stw094) for `disabled` elements — the binding is downgraded to one-way.
