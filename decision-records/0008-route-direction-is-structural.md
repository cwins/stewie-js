# 0008 — Route transition direction is structural, not perceptual

Date: 2026-06-12

## Status

Accepted. Recorded retrospectively on 2026-08-19; the date above is the
decision date, taken from `feat(router): View Transitions + scroll
restoration coherence`. Shipped in 0.9.0.

## Context

The router drives the View Transitions API and must tell CSS what kind
of navigation is happening, so authors can write directional animations
(slide left on forward, right on back).

"Direction" turns out to be two different questions wearing one word:

- **Structural** — did the route tree move deeper, shallower, or
  sideways?
- **Perceptual** — does the *user* feel like they moved forward?

They disagree. Navigating `/products/12345 → /products/98765` is the
same route chain with different params: structurally nothing moved, but
a user tapping "next product" perceives forward motion.

Inferring perceptual direction means inferring intent from params — is
`98765 > 12345` forward? is it a sequence at all? does a slug order? The
router cannot know. Any answer is a heuristic that is right often enough
to be relied on and wrong often enough to produce animations that fight
the user.

We considered:

1. Emit perceptual direction, inferred from params where possible.
2. Emit structural direction only.
3. Emit structural direction, plus a per-navigation author override.

## Decision

Go with option 2 for v1. Two orthogonal fields on `NavigationStatus`:

- `kind: 'push' | 'replace' | 'traverse' | 'reload'` — **mechanical**,
  mirroring the Navigation API's `navigationType`. In the popstate
  fallback only `traverse` is observable.
- `routeDirection: 'forward' | 'back' | 'default' | 'same'` —
  **structural**, computed by comparing the source route chain to the
  destination chain via pattern-prefix check. `same` means the same
  chain with only params or query changed.

So `/products/12345 → /products/98765` is `same`. That is the decision,
not an oversight.

Emitted View Transition types: always `stewie-kind-{kind}` and
`stewie-direction-{routeDirection}`; plus `stewie-transition-{group}`
only when both source and destination chains carry that transition group
*and* direction is `forward` or `back`. Sibling-tab moves (`default`)
and param-only moves (`same`) therefore do not emit the group, so
authors need not write CSS to suppress unwanted slides.

Authors who want motion between sibling products use the
`stewie-kind-push` type or animate at the component level, where the
intent is actually known.

**Alternatives considered.** Option 1 was rejected in rubber-wall
review: a params-derived heuristic is precisely the MobX/RxJS failure
pattern Stewie exists to avoid — behaviour that depends on the recipe
being just right, where being wrong is invisible until it looks wrong on
someone's screen. Option 3 was deferred rather than refused; see the
tripwire below.

## Consequences

- The contract is explainable in one sentence and never surprises: the
  types describe what the route tree did, which is knowable, rather than
  what the user felt, which is not.
- Authors wanting perceptual motion must write it themselves. This is a
  genuine ergonomic cost, paid deliberately.
- `same` will read as a bug to anyone who has not read this record. It
  is the most likely decision here to be "fixed" by a future
  contributor.
- **Tripwire:** if a third canonical-app instance hand-rolls
  per-component perceptual direction for the sibling-params case,
  revisit option 3 — an opt-in `navigate({ direction: 'forward' })`
  override. Author-declared intent is sound in a way that inference is
  not; this decision rejects the inference, not the capability.
- Redirects recompute rather than inherit: a guard redirect re-navigates
  with `replace: true`, so `kind` becomes `'replace'` and
  `routeDirection` is recomputed against the final destination. This
  keeps `/private → /login` out of the history stack.
- Lazy routes must be preloaded before `startViewTransition` fires,
  otherwise the transition snapshots an empty boundary and animates to
  nothing. The router awaits `router.preload()` on the matched chain.
- `view-transition-name` uniqueness stays the author's responsibility;
  the router does not auto-scope names.
- Out of scope for v1: back/forward distinction *within* `traverse`,
  scroll-to-anchor after async data resolves, per-route scroll config,
  and leaf-route override of a layout's transition group.
