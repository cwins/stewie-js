# 0001 — Mock outbound HTTP at the fetch layer, not per-client

Date: 2026-04-12

## Status

Accepted

## Context

Our integration tests previously stubbed each external SDK individually
(Stripe, SendGrid, Slack, internal-billing). Each new integration meant
adding a new mocking helper and a new pattern for asserting calls. Test
setup was 30+ lines for routes that touched two services, and a refactor
that swapped one client for another (e.g. the official Stripe SDK for a
thin internal wrapper) silently invalidated all the existing stubs
because they targeted the SDK's internal methods, not the wire calls.

We considered:

1. Per-client manual mocks (status quo).
2. A shared in-memory router that intercepts `fetch()` and matches on
   URL + method.
3. Recording real HTTP responses with a tape library and replaying them.

Option 3 is appealing for fidelity but couples test data to whatever
the upstream services returned at record time, which rots quickly and
is hostile to dev-mode without network.

## Decision

Adopt option 2: install a single `fetch` interceptor in the test setup
file and route all outbound calls through it. Tests register handlers
by `(method, urlPattern) -> Response`. Anything not registered throws,
making accidental real network calls impossible.

This is the only mocking layer for HTTP. SDK-level mocks are removed.

## Consequences

- Tests assert on the wire (URL, headers, body) instead of on SDK
  internals. Refactors that swap clients no longer break tests.
- One pattern to learn; one place to look when a test is mysteriously
  hitting the network.
- We lose the ability to assert that a specific SDK method was called
  with a specific argument shape. In practice this has not mattered —
  the wire-level assertion catches the same bugs and is more stable.
- Requires a single shared setup file (`test/setup-fetch.ts`) that runs
  before every test; CI must enforce this so a missed import doesn't
  silently re-enable real network calls.
