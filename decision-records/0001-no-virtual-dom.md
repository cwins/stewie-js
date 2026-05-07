# 0001 — No virtual DOM in the renderer

Date: 2025-11-08

## Status

Accepted

## Context

The renderer needs a strategy for translating component output into DOM
mutations. The dominant pattern in the React-shaped ecosystem is to
build a virtual tree on each render and diff it against the previous
tree to compute a minimal mutation set.

Stewie is signal-driven from the ground up. Each reactive expression
already knows exactly which signals it reads, and the runtime already
re-runs only those expressions when their signals change. A virtual
DOM diff would be redundant work to recompute information the
reactivity system already has.

We considered:

1. A virtual DOM with structural diffing (React-style).
2. A reconciliation step that diffs only the components flagged dirty
   by the signal graph (a hybrid).
3. Direct DOM mutation from each reactive expression, with no diff at
   all.

Option 2 keeps the diff but scopes it. Option 3 removes the diff
entirely.

## Decision

Go with option 3. Each reactive expression in the JSX produces a real
DOM node directly. When a signal changes, only the expressions that
read it re-run, and they update their owned DOM in place. There is no
intermediate tree, no reconciliation pass, and no diff.

**Comment nodes as reactive anchors.** Dynamic children (function
children, `Show`, `For`, `Switch`) place an inert `<!---->` comment in
the DOM as a stable insertion anchor. A reactive slot can render zero,
one, or many nodes, and those nodes can change. Without a stable
marker, the effect has no DOM reference to insert against when the
previous render produced nothing, or when adjacent siblings are also
dynamic. The comment is inert to layout, invisible to users, and costs
essentially nothing. This is a direct consequence of the no-vdom
decision — without a virtual tree to walk, each reactive effect needs
its own anchoring strategy.

## Consequences

- Updates are precisely targeted by construction. There is no "render
  the world, diff, mutate" cycle and no need for memoization to avoid
  it.
- Bundle size and runtime cost of the renderer drop substantially
  versus a vdom implementation.
- The reactivity primitives (`signal`, `computed`, `effect`) become
  load-bearing — they are not an optimization layer over a vdom, they
  are how rendering works at all. Bugs in dependency tracking become
  visual bugs.
- Patterns that assume "render is cheap and idempotent" do not apply.
  A reactive expression runs as a side effect; authors who write code
  that depends on re-running pure renders for invalidation will be
  surprised. Dev-mode warnings and the explanatory devtools mitigate
  this.
- Comment anchors are a visible implementation detail in the DOM.
  Browser devtools and snapshot-based tests will show them. This is
  expected and intentional.
- Closes the door on a diff-based future. Any renderer-level feature
  that would be trivial with a vdom (e.g. a single hook that snapshots
  the previous tree) has to be rebuilt as a signal-aware primitive.
