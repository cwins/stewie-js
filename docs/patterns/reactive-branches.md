# Reactive Branches and Child Component Props

## The pattern

When you pass reactive values as props to a child component inside a `Show` (or `Switch`/`Match`) branch, those props are evaluated once — at the time the JSX element is created — not when the branch mounts.

```tsx
// ⚠️ results() is evaluated when this JSX expression runs,
// not when Show decides to mount the branch.
<Show when={() => results().length > 0}>
  <ResultGrid items={results()} />
</Show>
```

If `results()` is empty at first and later populated (e.g. after an async fetch), the branch condition will correctly become truthy, but `ResultGrid` will receive the original empty array it was created with.

## Why this happens

JSX is syntax sugar for function calls. `<ResultGrid items={results()} />` compiles to:

```ts
jsx(ResultGrid, { items: results() })
```

`results()` is called immediately when that line executes. `Show` receives a snapshot of the already-evaluated JSX element — it has no way to re-evaluate the props later.

## The fix: function children

Wrapping the branch content in a function defers evaluation until `Show` actually mounts the content:

```tsx
<Show when={() => results().length > 0}>
  {() => <ResultGrid items={results()} />}
</Show>
```

Now `results()` is called fresh each time the branch mounts, so the component always receives the current value.

This applies to any props that depend on reactive values:

```tsx
<Show when={() => Boolean(info())}>
  {() => (
    <Pagination
      page={currentPage()}
      totalPages={info()?.pages ?? 1}
      onPrevious={handlePrev}
      onNext={handleNext}
    />
  )}
</Show>
```

## When you don't need function children

Static content that doesn't depend on reactive values is fine as a direct child:

```tsx
<Show when={isOpen()}>
  <p>This text never changes, so no function child needed.</p>
</Show>
```

The rule of thumb: if any prop passed to a child component inside a branch reads a reactive value, use a function child.

## Alternative: pass signals as props

If a component is designed to accept a signal or getter as a prop, callers can pass the signal directly and avoid the function child entirely:

```tsx
// Component accepts a getter
function ResultGrid(props: { items: () => Result[] }) { ... }

// Caller passes the signal itself — no snapshot
<Show when={() => results().length > 0}>
  <ResultGrid items={results} />
</Show>
```

This is a component API design choice, but it's a useful pattern for components that always expect live data.

## This can look like other bugs

Stale props inside a reactive branch are easy to misread as:

- a failed API fetch (data is present but the component shows nothing)
- broken list rendering
- broken pagination staying at its initial state

If a child component inside a `Show` is rendering stale or empty data despite the branch condition being true, stale props are the first thing to check.
