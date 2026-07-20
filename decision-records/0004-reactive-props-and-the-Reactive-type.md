# 0004 — Reactive props across component boundaries, and the `Reactive<T>` type

Date: 2026-07-13

## Status

Accepted

## Context

Passing live data into a child component requires **accessor-typed props**:
the parent writes `<Child name={() => episode().name} />`, the child types
`name: () => string`, and reads `props.name()`. This appeared to contradict
Stewie's stated principle that the developer should not have to write code
differently for reactivity to work — the `() => T` leaks into every reusable
component's public type signature ("contagion").

Three options were on the table (parked 2026-05):

- **(a) Accessor-typed props** (the current state) — honest and simple, but the
  `() => T` shows up in signatures. Components that want to accept either a
  static or a reactive value end up typing `T | (() => T)`.
- **(b) Proxy props** à la Solid — `props` is a Proxy that tracks per-property
  reads, so `props.name` stays live with a plain `name: string` type. But
  destructuring silently breaks reactivity (`const { class: cls, ...rest } =
  props`), which is why Solid ships `mergeProps`/`splitProps` as a permanent
  ecosystem tax.
- **(c) Compiler-rewritten access** — author writes plain types and
  `props.name`; the compiler instruments both ends so reactivity flows
  transparently (SwiftUI `@Observable`/`@Binding` inspiration). Most aligned
  with the "don't write code differently" principle, but a detailed design pass
  surfaced a load-bearing gotcha cluster (below) and, decisively, it makes the
  compiler **required for correctness** — contradicting Bet #1 ("compiler is
  optional").

**Evidence that forced the decision now.** The Work Queue canonical app tripped
the revisit tripwire on the *contagion type-signature* axis: `UserChip` shipped
`T | (() => T)` with a hand-rolled `resolve()`; `UserPicker`/`TaskRow` spread
accessor types across every reuse boundary. It did **not** trip the
*destructuring-loses-reactivity* axis (no destructured-prop bugs). The external
Pokemon demo did not feel the contagion at all, because its components stayed
page-local — sharpening that contagion bites at **reuse boundaries**, not
one-off pages.

## Decision

**Keep option (a). Make it ergonomic and honest rather than trying to remove
the `() => T` from signatures.** Concretely:

1. **Accessor-only over the union.** A reactive prop is typed `name: () =>
   string`; a genuinely static prop is typed `name: string`. Avoid `T | (() =>
   T)`. Accessor-only is unambiguous (the child always reads `props.name()`, no
   `resolve()` helper, no arm-branching) and makes "consumer accidentally passed
   the static arm and silently lost reactivity" unrepresentable.

2. **Ship `type Reactive<T> = () => T`** from `@stewie-js/core`. A type-only
   export (spends no runtime API-surface budget). `name: Reactive<string>` reads
   as intent ("this prop is live") where a bare `() => string` does not, and it
   gives docs and the compiler one canonical thing to key off. `Signal<T>` and
   `Computed<T>` are callable, so they are already structurally assignable to
   `Reactive<T>` — `name={mySignal}` type-checks with no change to signal types;
   store fields connect through a thunk (`name={() => state.user.name}`).

3. **Extend the compiler's type-aware auto-wrap to component props**, keyed on
   the `Reactive` alias symbol (resolved to core's declaration, not just the
   name; shape `() => T` is the heuristic fallback). The rule is asymmetric:
   - The **prop** type is the trigger — resolves to `Reactive`/accessor ⇒ this
     prop wants a live value.
   - The **passed argument** decides wrap-vs-pass-through: already an accessor
     (`Signal`/`Computed`/`Reactive`/`() => T`) ⇒ pass through untouched (never
     double-wrap `name={mySignal}` into `() => mySignal`); a bare value or
     reactive expression (`name={user().name}`) ⇒ wrap in `() =>`.
   - With the compiler on, `name={user().name}` and even a static
     `name="literal"` just work. With the compiler **off**, the author writes
     the `() =>` themselves — more verbose, still correct. Correctness never
     depends on the compiler, so Bet #1 holds.

4. **Branding is explicitly declined.** A nominal `Reactive<T> = (() => T) & {
   __brand }` would let the type system reject a non-reactive thunk at the prop
   boundary, but it would force inline thunks (and signals) to be stamped, break
   the plain-`() =>` and `name={mySignal}` ergonomics, and pull straight toward
   compiler-required. Not worth it.

5. **Dead-thunk detection is not part of the type story.** Whether an accessor
   is actually wired to a signal (vs. `() => getRandomName()`) cannot be seen by
   the type system — even branding only checks the annotation, not the body. If
   we want to flag "this `Reactive<T>` reads no reactive sources," it is a
   best-effort **lint** (DIAGNOSTICS.md `STW033`), orthogonal to this decision.

## Rationale

- **No free lunch.** Removing signature contagion *fundamentally* requires (b)
  or (c): the child type is only `() => T` because the child must *read* it as
  an accessor; letting the author write `name: T` and read `props.name` live
  needs a runtime proxy or compiler-rewritten reads. "Reduce the friction" and
  "remove the contagion" are different projects; only the second forces the hard
  choice, and it costs Bet #1.
- **Accessor-only is the only option that is naturally destructure-safe.** The
  reactivity lives in *calling* the accessor, not in *accessing the property*:
  `const { name } = props; … name()` still tracks. That is exactly the footgun
  (b) can't escape. The axis we most worried about future-proofing against is
  one (a) can't trip.
- **Coherence with the execution model is the real argument.** Component bodies
  run **once, at setup**; there is no re-render loop. So an inline `() => …` is
  allocated once and, if static, called once (its binding effect subscribes to
  nothing and never re-fires). Accessor-typed props are an anti-pattern in React
  (identity churn every render, defeating `memo`/`useCallback`) and idiomatic in
  Stewie *for the same underlying reason*. Choosing (a) is not settling — it is
  the shape that falls out of the framework's core. (The *magnitude* of any
  perf difference needs benchmarks; the *structural* difference — setup-cost vs.
  per-render-cost — is real.)
- **`() => T` is an honest marker, not a wart.** Analogous to SwiftUI's
  `Binding<T>` — a distinct type that says "this is live." Named via `Reactive`
  and made ergonomic by auto-wrap, it is clarity, not contagion. This is also
  the differentiation-aligned answer to "why not just do what Solid/React do":
  because our execution model makes the honest, no-magic version the ergonomic
  one.
- **The alias-symbol hook recovers the "typecheckable from the parent"
  intuition without branding.** A plain alias is structurally identical to `()
  => T`, so it grants no extra *type-system* power — but the TypeChecker exposes
  the alias symbol, so the *compiler* can recognize props declared with core's
  `Reactive` precisely (avoiding false-positives on incidental thunks like event
  handlers). Structural compatibility for humans, alias identity for the
  compiler.

## Consequences

- **Zero new runtime API.** `Reactive<T>` is a type. The convention plus one
  bounded compiler enhancement is the whole change.
- **Compiler stays optional; correctness never depends on it.** Compiler-off
  code is more verbose (explicit `() =>`), never silently wrong. Stage 2
  (removing contagion via (b)/(c)) is shelved and may never be needed.
- **Prototype risk — RETIRED (spike, 2026-07-20).** A TypeChecker spike over an
  in-memory program confirmed the `Reactive` alias symbol is detectable at the
  JSX/call-site via `getContextualType(attributeInitializer).aliasSymbol`, and
  it (a) distinguishes `Reactive<T>` from a bare `() => T` and from a plain
  value, (b) **survives generic instantiation** (`item: Reactive<T>`
  instantiated to `Reactive<string>` still carries the alias symbol resolving to
  core), and (c) survives cross-module import (identity resolves back to core's
  declaration). So the primary detection is the alias symbol, not the
  accessor-shape heuristic — which is *more* precise (it won't wrap an incidental
  `() => T` prop such as an event callback). A syntactic fallback (resolve the
  `TypeReferenceNode.typeName` to core's `Reactive`) also works independently of
  alias-symbol preservation. The remaining implementation confirmation is narrow:
  that JSX-attribute contextual typing behaves identically to the object-literal
  proxy the spike used (same contextual-typing machinery — expected to transfer).
- **Auto-wrap of component props is narrower than full (c):** because the wrap
  is *gated on the declared prop type being accessor-shaped*, it leaves `ref`,
  `as`, `children`, and static `T` props untouched by construction — which
  sidesteps most of the (c) gotcha catalog (those came from a blanket "value →
  thunk" rule). Spread props (`{...rest}`) can't be type-directed cheaply and
  degrade to manual thunking; acceptable, since spreads of reactive props are
  rare.
- **Migration:** add the `Reactive` export; migrate Work Queue's `UserChip` from
  `T | (() => T)` + `resolve()` to accessor-only `Reactive<T>`; extend the
  compiler auto-wrap; document the convention in the "Stewie way" and Components
  guides.
- **The (b)/(c) gotcha catalog is preserved below** as the record of why they
  are shelved, so a future revisit doesn't re-derive it.

### Preserved: the (c) gotcha catalog (why compiler-transparent props are expensive)

- **Override-merge spread.** `const merged = { ...props, label: 'x' }; <Inner
  {...merged} />` mixes already-thunked props-bag fields with un-thunked
  literals; neither origin-based pass-through nor type-driven thunking is
  correct. This is the case Solid's `mergeProps` exists for.
- **Refs** (`ref={...}`) are callback-or-object unions — neither value- nor
  function-typed; need an explicit third category.
- **Polymorphic `as`** (`<Box as={Heading} />`) — `as` is a value-typed
  `ComponentType`; a child-site "rewrite reads to `props.as()`" rule is wrong.
- **Static JSX children of components** — under "all value-typed props are
  thunks," `props.children` becomes a thunk, breaking every existing read.
- **Destructuring depth** — "destructure the bag = reactive; destructure a value
  = snapshot" is Solid's specific line, which Solid users still trip on. Not
  universal.
- **`as any` semantics** — origin tracking through casts can't depend on author
  intent; pick "cast opaque" or "see through casts and own the false positives."
- **`visitJsxChildren` / the intrinsic guard** (`analyzer.ts` `if
  (!isIntrinsicElement(tagName)) return;`) exists because component children
  flow to `props.children` and the wrap point is the consumer. Deciding which
  side owns the wrap is the real work, not removing the guard.
- **First-encounter footgun on CDN/sandboxes** — without the compiler, prop
  instrumentation is skipped and reactivity dies silently with no obvious error.
- **Production-build safety** — a per-module `__STEWIE_COMPILED__` marker is
  insufficient (bundles mix compiled/uncompiled); only a Vite-plugin build-time
  assertion prevents shipping silently-broken reactivity.
- **Compiler-load-bearing posture shift** — moving from "compiler optional" to
  "compiler required for idiomatic composition" reverses part of Bet #1's
  identity and must be argued, not absorbed.

### Preserved: tightly-coupled question — library publish format

Option (c) only pays off if the compiler can see into third-party libraries,
which requires libraries to publish **preserved JSX** (`tsc` with `jsx:
"preserve"` → `.jsx` + `.d.ts`; the consumer's Vite plugin compiles
`node_modules`). This is the Svelte/Vue SFC model. Gotchas: CDN sandboxes can't
load `.jsx` directly; `.d.ts` JSX-namespace versioning must agree across
workspace deps; HMR through `node_modules` needs watcher config. A
`@stewie-js/compiler/jit` CDN bundle is possible as a dev-only convenience, not
v1. Preserved JSX is also useful in an accessor-typed-prop world (it lets
auto-wrap reach into libraries), so it can be evaluated on its own merits when
there's pressure.

### Preserved: canonical-app observations (2026-05-28)

- Accessor types spread at every reusable boundary in Work Queue (`UserPicker`,
  `UserChip`, `TaskRow.usersById`); `UserChip` shipped `T | (() => T)` + a
  `resolve()` helper — the exact contagion (a) predicted.
- The function-children-as-array papercut (`{() => users.map(...)}`) and an
  IIFE-in-JSX derive-then-render are separate ergonomic issues; a typed
  `Children`/`Fragment` improvement may address them independently of reactive
  props.
- `peek()` in action payloads read cleanly — the friction was at *component
  composition*, not signal usage inside one component.
- Pokemon (external, page-local components) did not flag reactive props at all —
  the cost is paid at reuse boundaries / shared component kits, not one-off
  pages.

## Revisit trigger

Reopen only if (1) a concrete case shows the `Reactive<T>` signature is a real
blocker (not merely visible), or (2) Stewie decides to court library/component-kit
authors such that removing contagion becomes a product requirement — at which
point the compiler-posture decision (and the publish-format question) must be
made explicitly, using the preserved catalog above as the known cost.
