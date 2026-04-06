# Derived Collections from Store State

## The pattern

When you derive a list from a `store()` value, a plain assignment creates a snapshot — not a live view:

```ts
// ⚠️ snapshot — captures the current array once
const tasks = app.tasks.filter(t => t.projectId === projectId)
```

If `app.tasks` is later replaced (e.g. after a save or delete), `tasks` still holds the old filtered array. The UI goes stale.

## Why this happens

`store()` properties are reactive when read inside a reactive context (`effect`, `computed`, JSX expression). A direct assignment outside a reactive context just calls `.filter()` once and stores the resulting plain array. There's nothing to re-run the derivation later.

## The fix: make the derivation reactive

Wrap the derivation in `computed()` or a getter function so it re-runs whenever the source changes:

```ts
// ✅ computed — re-runs when app.tasks changes
const tasks = computed(() => app.tasks.filter(t => t.projectId === projectId))

<For each={tasks} by={(task) => task.id}>
  {(getTask) => <TaskRow task={getTask()} />}
</For>
```

Or as a plain getter function, which is lighter-weight when you don't need memoization:

```ts
// ✅ getter function — re-evaluates on each reactive read
const tasks = () => app.tasks.filter(t => t.projectId === projectId)
```

Both forms work with `<For>`, `<Show>`, and anywhere that accepts `() => T[]`.

## When it shows up

The symptom is typically: an operation (save, delete, reorder) updates the store correctly — you can log the state and confirm it changed — but the UI doesn't reflect the update. The list appears frozen at its state from when the component first rendered.

The cause is almost always a snapshot derivation:

```ts
// anything like this:
const filtered = store.items.filter(...)
const sorted   = store.items.slice().sort(...)
const mapped   = store.items.map(...)
```

None of these are reactive. They run once when the component function executes.

## Full example

```tsx
function ProjectTasks({ projectId }: { projectId: string }) {
  const app = inject(AppContext)

  // reactive derivation — stays live as app.tasks changes
  const tasks = computed(() =>
    app.tasks.filter(t => t.projectId === projectId)
  )

  return (
    <Show when={() => tasks().length > 0} fallback={<p>No tasks yet.</p>}>
      <For each={tasks} by={(task) => task.id}>
        {(getTask) => <TaskRow task={getTask()} />}
      </For>
    </Show>
  )
}
```

## `computed` vs getter function

Both work. The difference is memoization:

- **`computed()`** caches the result and only re-evaluates when a dependency changes. Downstream subscribers (like `<For>`) are only notified if the result is a new array reference. Better for expensive derivations or when you want to avoid unnecessary re-renders.
- **getter function `() => ...`** re-evaluates on every reactive read. Simpler. Fine for cheap operations.

For most filtered/sorted list views, `computed()` is the better default.
