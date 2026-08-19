# 0005 — Reactive primitives are scoped, never module-global

Date: 2026-03-20

## Status

Accepted. Recorded retrospectively on 2026-08-19; the date above is the
decision date, taken from when module-scope validation shipped with the
compiler.

## Context

`signal()`, `computed()`, `effect()`, and `store()` create state that
lives for as long as whatever owns it. The question is what may own
them — specifically, whether a module's top level is a legal place to
call them.

Module scope is the most convenient place to put shared state, and
several signal libraries permit it. It is also the one place where the
lifetime is wrong: a module body evaluates once per process, not once
per consumer.

On the client that is merely surprising. On the server it is a
correctness bug. `@stewie-js/server` renders many requests in one
process, so a module-scope signal becomes an accidental singleton
shared across every concurrent request — one user's state leaking into
another user's render. The failure is silent, load-dependent, and does
not reproduce in a single-request dev session, which makes it close to
undebuggable after the fact.

We considered:

1. Allow module-scope reactivity and document the SSR hazard.
2. Allow it, but isolate each request in its own module registry or
   worker so the singleton is per-request.
3. Forbid it: reactive primitives must be created inside a component or
   an explicit `reactiveScope()`.

## Decision

Go with option 3. Reactive primitives must be created inside a
component body or a `reactiveScope()`. Module scope is not a legal
owner.

Enforcement is layered:

- The compiler treats it as a **hard error**, not a warning
  (`packages/compiler/src/analyzer.ts`, diagnostics STW001–004). A build
  fails rather than shipping a request-leaking singleton.
- The runtime warns in dev mode, so the plain-JSX path without the
  compiler (see ADR 0006) still surfaces the mistake.

Definitions are deliberately exempt, because they create no signals.
`defineAction` and `defineResource` return opaque descriptors and are
*encouraged* at module scope; only the corresponding `useAction` /
`useResource` calls allocate per-component state. See ADR 0007.

Component bodies are themselves reactive scopes. `reactiveScope()` is
only needed for reactive code that is *not* inside a component.

**Alternatives considered.** Option 1 was rejected because the failure
mode is silent cross-request state bleed — the class of bug that
documentation reliably fails to prevent. Option 2 was rejected as a
large runtime and adapter burden to preserve a convenience that a
one-line `reactiveScope()` already covers, and it would have pushed
per-request isolation into every adapter rather than keeping it a
property of the programming model.

## Consequences

- Cross-request state bleed is structurally impossible for code that
  compiles, rather than a hazard authors must remember.
- Genuinely app-global state costs slightly more ceremony: it must be
  created inside a scope the app owns and passed down via context, or
  held as a plain (non-reactive) module value.
- A hard compiler error is a blunt instrument. Legitimate-looking code
  gets rejected, and the diagnostic has to be good enough to explain
  why — this is a standing cost on the diagnostics work, not a one-time
  one.
- The rule is only fully enforced when the compiler runs. Without it,
  authors get a dev-mode warning, which is weaker. This is an accepted
  consequence of ADR 0006 rather than a gap to close.
- Because component bodies are already scopes, the rule is invisible in
  ordinary component code. It is only felt at module level, which is
  exactly where we want the friction. Note that this has a
  discoverability cost in the other direction: an external demo app
  wrapped component-body signals in a redundant `reactiveScope()`,
  having inferred a stricter rule than the one that exists.
