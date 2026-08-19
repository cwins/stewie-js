# 0007 — `define*` / `use*` split for actions and resources

Date: 2026-04-26

## Status

Accepted. Recorded retrospectively on 2026-08-19; the date above is the
decision date, taken from the commits that reshaped both primitives
(`ship defineAction + useAction`, `reshape resource into defineResource
+ useResource`, both 2026-04-27).

## Context

Actions (write-side mutations) and resources (read-side async data) both
need to pair a *description of the work* with *per-component reactive
state* — `pending`, `error`, and the result.

The obvious shape is a single factory: `action(fn)` returning an object
carrying its own signals. An unshipped `action()` prototype took exactly
that form. It collides directly with ADR 0005: a mutation is naturally
declared once, next to its API call, at module scope — but anything
owning signals cannot live there, because the signals would be shared
across every component and every SSR request.

We considered:

1. One factory (`action(fn)`) that creates signals, callable only inside
   a component. Mutations must then be declared inside components,
   repeatedly, or wrapped in a factory-of-factories.
2. A factory returning a definition with a `.use()` method
   (`myAction.use()`), so the definition is module-safe and the method
   creates state.
3. A split: `defineAction(fn)` returns an opaque, signal-free
   definition; a free function `useAction(def)` creates the
   per-component instance.

## Decision

Go with option 3, applied identically to both primitives:

- `defineAction(fn)` / `defineResource(fn)` return opaque descriptors.
  They create **no signals** and are explicitly safe — and encouraged —
  at module scope. The compiler's module-scope rule exempts them for
  this reason.
- `useAction(def)` / `useResource(def, source)` are **free functions**,
  not methods, creating the per-component instance.

Free functions rather than `def.use()` (option 2) because it matches the
shape already established by `consume(Context)`: the ambient thing is
the argument, not the receiver. `def.use()` reads as though the
definition owns the instance, when in fact the *calling scope* owns it.

The action instance is `{ run, pending, error, lastRun, reset }`.

**`lastRun` exists for a specific reason.** `run` resolves with the
action's return value on success and `undefined` on caught error, so the
natural `result !== undefined` test is ambiguous for a void-returning
mutation: success and failure both produce `undefined`.
`lastRun: Signal<'idle' | 'success' | 'error' | 'blocked'>` lets those
branch unambiguously after `await act.run()`. Branching on `error`
alone was the earlier workaround and is strictly worse — it cannot
distinguish "succeeded" from "never ran" (`'blocked'`).

Further settled semantics: `run` no-ops while pending and records
`'blocked'`; `error` holds an `Error | null`; `reset()` clears `error`
and `lastRun` and no-ops while pending; there is no cancellation in v1;
and post-mutation work (navigation, toasts, store sync) lives in caller
code after `await act.run()` rather than in lifecycle callbacks.

The reactive-triggering asymmetry between the two primitives is
intentional and not a wart: resources fire on source change, actions
fire on explicit `.run()`. That is what distinguishes reading from
writing.

## Consequences

- Mutations and fetches can be declared once, at module scope, beside
  the API layer they wrap, while their reactive state stays correctly
  per-component and per-request.
- Two exported names per primitive instead of one. This is a real cost
  against the minimal-API-surface principle, accepted because the
  alternative is either an SSR correctness hole or a `.use()` shape that
  misleads about ownership.
- The pattern is now the template for any future primitive that pairs a
  static description with per-component state. Diverging from it should
  be a deliberate, recorded choice.
- `lastRun` is easy to mistake for redundant state next to `pending` and
  `error`, and a future simplification pass may try to remove it. The
  void-collision above is the reason it must stay.
- No cancellation for actions in v1 means a slow mutation cannot be
  abandoned; the component must tolerate a late resolution. Resources do
  cancel, via `AbortController`.
- Because definitions are opaque, they can later carry metadata without
  a breaking change. `defineResource`'s `{ id }` option for SSR replay
  and cross-component dedup was added this way.
