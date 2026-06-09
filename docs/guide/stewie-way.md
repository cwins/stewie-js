# The Stewie Way

A short decision-oriented guide for the patterns that most often get re-invented. If you've reached for `effect()` or `reactiveScope()` to solve a problem, check here first — Stewie probably ships the primitive you actually want.

---

## Setting a page title or meta tag

**Use `useTitle` and `useMeta`.** Not `effect()`, not `document.title = …`.

```tsx
import { useTitle, useMeta, useResource } from '@stewie-js/core'

function ProductPage() {
  const product = useResource(fetchProduct, () => params.id)
  useTitle(() => product.data()?.name ?? 'Loading…')
  useMeta({ name: 'description', content: () => product.data()?.summary ?? '' })
  return <article>...</article>
}
```

**Why not `effect(() => document.title = …)`?**

- It doesn't work on the server. Your SSR'd HTML will have whatever title was in the template, not the one your component derived.
- It doesn't clean up. If the component unmounts, the title sticks.
- It hand-rolls a primitive that's already shipped — Stewie users keep re-inventing this exact line.

`useTitle` works on the client (mutates `document.title` reactively), on the server (registers with the SSR head context), and inside Suspense boundaries (emits an inline `<script>document.title = '…'</script>` patch when the boundary flushes).

See [Core API → Head / Metadata](../reference/core-api.md#head--metadata).

---

## Reading data: loader vs `useResource`

Both exist because they answer different questions.

| You want… | Reach for | Why |
|---|---|---|
| Data that **must** be ready before the route mounts. Authentication checks. Server-side filtering driven by path params. | **Route loader** (`load`) | Runs before the component mounts; the route doesn't render until it resolves. SSR-friendly. |
| Component-local data. Data driven by **query** params (`?q=…`, filters, pagination). Anything that should refetch as the user types or interacts. | **`useResource`** | Re-runs when its source thunk changes. Deduplicates by registry key. SSR-replayed automatically. |

The most common mistake is to put query-reactive data in a loader and then be surprised when `setQuery()` doesn't refetch it. `setQuery()` intentionally does not re-run loaders — it's a URL annotation only. For data that depends on query params, declare the dependency at the fetch site:

```tsx
// In the loader (runs on real navigation — auth, path params):
export const load = async (params) => loadProduct(params.id)

// In the component (re-runs every time location.query.tab changes):
function ProductPage() {
  const productData = useRouteData<ProductData>()
  const reviews = useResource(fetchReviews, () => location.query.tab === 'reviews' ? params.id : null)
  // ...
}
```

This co-locates the dependency declaration with the fetch, so the caller of `setQuery()` doesn't need to know which loaders care about which query keys.

See [Core API → Async Data](../reference/core-api.md#async-data) for the full `defineResource` / `useResource` shape.

---

## "Should I wrap this in `reactiveScope()`?"

**Almost always: no.**

If you're inside a component body, you're already inside a reactive scope. Just write:

```tsx
function Counter() {
  const count = signal(0)              // ✓ component body is a reactive scope
  const doubled = computed(() => count() * 2)
  effect(() => console.log(count()))
  return <button onClick={() => count.update(n => n + 1)}>{count}</button>
}
```

You do not need:

```tsx
// ✗ unnecessary — component bodies are reactive scopes
function Counter() {
  let count!: ReturnType<typeof signal<number>>
  reactiveScope(() => {
    count = signal(0)
  })
  // ...
}
```

`reactiveScope()` is for code that runs **outside** the component lifecycle: a web worker, a non-component utility module, a test fixture. The runtime warns in dev mode when `signal()` / `effect()` etc. are called at module scope (where they'd become accidental SSR singletons) — that warning is the cue to wrap your code in `reactiveScope()`, *not* to wrap a component body.

The compiler's module-scope-validation pass enforces this as a hard error at build time. If the compiler is happy, you don't need `reactiveScope`.

---

## Writing data: actions, not effects

For anything that writes — form submits, button-triggered mutations, optimistic updates — use `defineAction` + `useAction`. They give you `pending`, `error`, and `lastRun` for free, and they no-op while a previous run is in flight (so a button mash doesn't fire twice).

```tsx
const saveAction = defineAction(async (input: { id: string; name: string }) => {
  const res = await fetch(`/api/items/${input.id}`, { method: 'PATCH', body: JSON.stringify(input) })
  if (!res.ok) throw new Error('Save failed')
  return res.json()
})

function EditItem({ id }: { id: string }) {
  const name = signal('')
  const save = useAction(saveAction)

  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      await save.run({ id, name: name.peek() })
      if (save.lastRun() === 'success') navigate(`/items/${id}`)
    }}>
      <input $value={name} disabled={save.pending()} />
      <button disabled={save.pending()}>Save</button>
    </form>
  )
}
```

Don't build this out of `effect()` and a manual `pending` signal — you'll get the no-double-fire and error handling subtly wrong.

See [Core API → Async Data](../reference/core-api.md#async-data) for the full `Action<I, O>` shape.

---

## Forms

Stewie deliberately does **not** ship a `createForm()` primitive. The existing pieces already compose:

- **Field state** — one `signal()` per field.
- **Validation** — a `computed()` per rule.
- **Touched / dirty** — `signal(false)` flipped in `onBlur` / on first change.
- **Submit lifecycle** — `useAction(submitAction)` for `pending`, `error`, and `lastRun`.
- **Snapshot at submit** — `signal.peek()` at the call site (no reactivity inside the action body).

```tsx
function SignupForm() {
  const email = signal('')
  const emailTouched = signal(false)
  const emailValid = computed(() => /\S+@\S+/.test(email()))
  const submit = useAction(signupAction)

  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      await submit.run({ email: email.peek() })
    }}>
      <input
        $value={email}
        onBlur={() => emailTouched.set(true)}
        disabled={submit.pending()}
      />
      <Show when={() => emailTouched() && !emailValid()}>
        <p class="error">Please enter a valid email.</p>
      </Show>
      <Show when={submit.error}>
        {(err) => <p class="error">{err.message}</p>}
      </Show>
      <button disabled={() => submit.pending() || !emailValid()}>Sign up</button>
    </form>
  )
}
```

The `<form>` element is plain HTML. There is no Stewie-shaped form concept.

---

## Quick reference

| Don't reach for | Reach for | When |
|---|---|---|
| `effect(() => document.title = …)` | `useTitle(...)` | Anytime you want a reactive page title. SSR-safe. |
| `effect(() => fetch(...))` | `useResource(def, source)` | Component-local async reads. Refetches on source change. |
| `effect()` + `pending` signal + manual error catch | `useAction(def)` | Mutations triggered by user actions. |
| `reactiveScope()` around component code | Nothing | Component bodies are already reactive scopes. |
| `useHydrationRegistry()` for caching | Just use `useResource` | The data registry handles SSR replay automatically. |
| `createForm()` (doesn't exist) | `signal` + `computed` + `useAction` | Forms compose from the existing primitives. |

---

## What's *not* in this guide

Things that work fine and are well-covered elsewhere:

- The shape of [signals](reactivity.md), [computeds](reactivity.md), and [effects](reactivity.md) — see the Reactivity guide.
- How [`<Show>`, `<For>`, `<Switch>`](components.md#control-flow) work — see the Components guide.
- [Route configuration](routing.md), guards, and lazy routes — see the Routing guide.
- [SSR, streaming, and hydration](ssr.md) — see the SSR guide.

This page is intentionally short: it lists the patterns that get re-invented, not every pattern.
