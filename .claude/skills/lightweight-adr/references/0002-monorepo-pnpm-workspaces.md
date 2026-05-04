# 0002 — Monorepo via pnpm workspaces

Date: 2025-09-30

## Status

Accepted

## Context

We had three repos under active development that frequently changed
together: the public SDK, an internal client, and the example app the
SDK docs depend on. A coordinated change meant three PRs, three
release cycles, and a window where the example app was pinned to a
stale SDK version. Cross-repo refactors (renaming a public symbol,
adjusting a type) were expensive enough that we deferred them.

We considered:

1. Keep three repos and lean on Renovate / version-bump bots to
   propagate changes.
2. Merge into one repo with npm workspaces.
3. Merge into one repo with pnpm workspaces.
4. A heavier monorepo tool (Nx, Turborepo on top of npm).

Option 1 leaves the underlying friction in place. Option 4 adds a
build-graph tool we don't need yet — none of the packages have
expensive build steps that benefit from caching. The choice between
options 2 and 3 came down to disk usage (pnpm's content-addressed
store), install speed, and stricter dependency hoisting (pnpm fails
loudly when a package imports something it didn't declare).

## Decision

Single repo with `pnpm` workspaces. Each former repo becomes a
`packages/<name>` directory; cross-package references use
`workspace:*` so the lockfile guarantees they always resolve to the
in-tree version. CI runs the full test matrix on every PR.

No build-graph tool yet. Revisit if a single package's CI step grows
past ~2 minutes or if the test matrix becomes too coarse.

## Consequences

- Cross-package refactors land in one PR with one review. The
  coordinated-release problem disappears.
- Strict hoisting catches a class of bug where a package was
  accidentally relying on a transitive dep. Two such bugs surfaced
  during the migration; both were real.
- Onboarding gets a small papercut: contributors must install pnpm
  rather than using the npm they already have. Documented in the
  README's first section.
- Releases of individual packages now require an explicit version-bump
  step. Previously each repo's tag was the version; now we use
  `changesets` (or similar) to track which packages need to ship.
- Closing the door on the multi-repo layout means any future package
  that genuinely belongs in its own repo (e.g. a vendored fork of an
  upstream library) needs an explicit carve-out decision.
