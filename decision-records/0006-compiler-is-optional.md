# 0006 — The compiler is optional; the runtime is complete without it

Date: 2026-03-20

## Status

Accepted. Recorded retrospectively on 2026-08-19; the date above is the
decision date, taken from when `@stewie-js/compiler` first shipped
alongside an already-working runtime.

## Context

Stewie ships a compiler (`@stewie-js/compiler`, wrapped by
`@stewie-js/vite`) that transforms TSX into fine-grained reactive
output: auto-wrapping signal reads in JSX, the `$prop` two-way binding
transform, and module-scope validation.

A compiler that is *required* can assume more. Svelte-style frameworks
take this route and get a smaller runtime and a freer authoring syntax
in exchange for a mandatory build step. The alternative is a compiler
that only optimizes, with the runtime remaining independently correct.

The forcing question is what happens to an app that cannot or does not
use Vite — a plain `tsc` build, an esbuild pipeline, a test harness
importing components directly, or a consumer embedding Stewie in an
existing toolchain. If the compiler is load-bearing, all of those are
broken or second-class.

We considered:

1. Compiler required. The runtime may depend on transforms having run.
2. Compiler optional. Plain JSX via `jsxImportSource` produces a fully
   working app; the compiler only improves the output.
3. Compiler optional in principle, but with a set of "advanced"
   features that silently need it.

## Decision

Go with option 2. `jsxImportSource: '@stewie-js/core'` against
`packages/core/src/jsx-runtime.ts` yields a complete, correct
application. The compiler improves output; it never enables
correctness.

Two rules follow, and they govern feature work generally:

- **A transform may not be the only path to a behaviour.** Improvements
  that apply only when the compiler is present are acceptable;
  improvements that benefit both paths are always preferred.
- **The developer writes simple, obvious code; the compiler's job is to
  turn it into optimal fine-grained output.** Authors should not have
  to understand the optimization layer. If an optimization requires
  writing code differently to work, that is a design failure in the
  optimization, not a requirement on the author.

This is what makes the compiler a *complexity shield* rather than a
dependency: it absorbs the difference between naive and optimal output
so the author never has to think about it.

**Alternatives considered.** Option 1 was rejected because it would
make the WinterCG/runtime-portability bet (ADR 0002) hollow — running
on any standards-compliant runtime is worth little if it still demands
one specific build pipeline. Option 3 was rejected as the worst of
both: the failure mode is a feature that works in dev and silently
degrades elsewhere, which is precisely the kind of "recipe must be just
right" trap Stewie exists to avoid.

## Consequences

- Every feature is designed twice: once for the runtime path and once
  for what the compiler can do with it. This is a real, permanent tax on
  feature work.
- The runtime carries code a compiler-required design could have
  eliminated — the `jsx()` runtime must handle cases the DOM emitter
  would otherwise have specialized away. Bundle size is worse than the
  compiler-required ceiling.
- Enforcement of module-scope scoping (ADR 0005) is a hard error only
  under the compiler; without it, authors get a dev-mode warning.
  Accepted, not a gap.
- Correctness beats the micro-optimization when the compiler lacks
  information. The DOM-emit text-vs-node fix in 0.10.0 is the worked
  example: without a `TypeChecker` the emitter falls back to the `jsx()`
  runtime rather than guessing that a zero-arg call returns a string.
- Testing surface doubles in the places that matter. Compiler output and
  runtime output must stay behaviourally identical, which needs tests
  that assert on behaviour rather than on emitted code.
- Adoption is cheap: Stewie can be dropped into an existing toolchain
  and improved later by adding the Vite plugin. Nothing has to be
  rewritten to opt in.
