# 0003 — Structured JSON logs with a per-request correlation ID

Date: 2026-02-14

## Status

Accepted

## Context

Production logs were free-form `console.log` strings, formatted ad-hoc
by whoever wrote the line. Searching for "all events for one request"
meant grepping for a substring that might or might not be present
depending on which file emitted the log. Debugging a multi-service
trace required reading three log streams in parallel and eyeballing
timestamps, which sometimes worked and sometimes didn't.

The on-call rotation flagged three incidents in the last quarter
where the post-mortem stalled because the logs couldn't reconstruct
the request flow.

We considered:

1. A logging style guide that asks authors to include certain fields
   manually.
2. Wrapping every log call in a helper that injects context.
3. A structured JSON logger (pino / bunyan style) plus a request-scoped
   correlation ID propagated via async context.
4. Full distributed tracing (OpenTelemetry) as the primary tool.

Option 1 is unenforceable. Option 4 is the long-term answer but is a
larger rollout and requires a backend (Tempo / Honeycomb / etc.) we
haven't picked yet. Option 3 is the smallest step that actually
solves the immediate "can't reconstruct one request" pain.

## Decision

Adopt option 3 now and keep option 4 on the roadmap.

- All log lines are JSON. No more raw strings.
- Every inbound request generates (or extracts from `x-request-id`) a
  correlation ID stored in `AsyncLocalStorage`.
- The logger reads the correlation ID from async context and includes
  it on every line automatically; authors don't pass it.
- A small set of conventional fields is reserved: `level`, `msg`,
  `requestId`, `userId`, `service`, `version`. Anything else goes in
  a free-form `data` object.
- Log shipping is unchanged; the JSON structure means the existing
  log aggregator can index the new fields without backend work.

## Consequences

- Reconstructing a request becomes a single filter
  (`requestId=...`). The "stalled post-mortem" pattern goes away.
- Authors no longer think about correlation IDs at all — async
  context handles it. The temptation to pass IDs explicitly through
  function signatures (which previously polluted internal APIs) is
  removed.
- Any code path that escapes the request's async context (e.g.
  detached background jobs, raw `setImmediate` callbacks without
  context propagation) loses the correlation ID. We accept this and
  document the escape hatches.
- Locks in JSON as the log format. A future move to OpenTelemetry
  will ride on top of these fields rather than replacing them.
- Lightly couples us to `AsyncLocalStorage` semantics. Edge runtimes
  that don't fully implement it would need an explicit context-passing
  fallback; not a concern today but worth flagging.
