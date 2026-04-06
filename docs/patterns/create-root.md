# When to Use `createRoot`

## What `createRoot` does

`createRoot` creates a reactive ownership scope. Effects and computed values created inside it are owned by that root and can all be disposed together by calling `dispose()`.

```ts
const dispose = createRoot(dispose => {
  const count = signal(0)
  effect(() => console.log(count()))
  return dispose
})

dispose()  // stops the effect, cleans up
```

## You usually don't need it inside components

Stewie's renderer already executes every component function inside a reactive root. Signals, computed values, and effects created directly in a component body are owned by the component and disposed automatically when it unmounts.

```tsx
// ✅ fine — no createRoot needed
function Counter() {
  const count = signal(0)
  const doubled = computed(() => count() * 2)

  return (
    <button onClick={() => count.update(n => n + 1)}>
      {doubled}
    </button>
  )
}
```

Wrapping component-local state in `createRoot` adds ceremony without benefit:

```tsx
// ⚠️ unnecessary inside a component
function Counter() {
  let count!: ReturnType<typeof signal<number>>
  createRoot(() => { count = signal(0) })

  return <button onClick={() => count.update(n => n + 1)}>{count}</button>
}
```

The `let x!: ...; createRoot(() => { x = ... })` pattern also requires TypeScript's definite assignment assertion (`!`) because the variable is technically unassigned before the callback runs, which is an avoidable awkwardness.

## When `createRoot` is the right choice

### Outside components

When setting up reactive state in non-component code — utilities, app initialization, tests — there's no renderer-provided root. `createRoot` is required:

```ts
// app entry point
createRoot(() => {
  const router = createRouter()
  mount(<App />, document.getElementById('app')!)
})
```

```ts
// utility with its own lifecycle
export function createSession() {
  return createRoot(dispose => {
    const user = signal<User | null>(null)
    effect(() => { /* sync to localStorage */ })
    return { user, dispose }
  })
}
```

### An independently disposable nested scope

When you deliberately need a sub-scope that can be torn down independently of the component that created it:

```ts
function setupPanel() {
  return createRoot(dispose => {
    const open = signal(true)
    effect(() => { /* panel-specific side effect */ })
    return { open, dispose }
  })
}
```

This is legitimate because the intent is an independent lifecycle — not just local state.

### In tests

Vitest doesn't provide a reactive root. `createRoot` is necessary whenever you create signals, computed values, or effects in test code:

```ts
it('computed updates when signal changes', () => {
  createRoot(() => {
    const x = signal(1)
    const doubled = computed(() => x() * 2)
    expect(doubled()).toBe(2)
    x.set(5)
    expect(doubled()).toBe(10)
  })
})
```

## The rule of thumb

> Use `createRoot` for manually managed reactive scopes: app entry points, utilities with their own lifecycle, and tests. Inside normal component functions, create signals and effects directly.

Avoid calling `createRoot` multiple times inside a single component for ordinary state — multiple nested roots are usually a sign that the component is trying to manage lifetimes that the renderer already handles.
