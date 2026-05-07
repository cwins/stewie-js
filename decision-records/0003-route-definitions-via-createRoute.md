# 0003 — Route definitions via `createRoute(path, config)`

Date: 2026-05-06

## Status

Accepted

## Context

Stewie ships typed route params and query through `useParams<T>()` /
`useQuery<T>()` plus a hand-written `RouteDefinition<TParams, TQuery>`
interface (see `examples/work-queue/src/routes.ts`). Routes are
declared a second time in JSX as `<Route path="..." component={...}
load={...} />`. The two declarations must be kept in sync by the
author: rename a path segment in JSX without updating the
`RouteDefinition`, and `useParams` returns the wrong shape.

The previously planned remedy was a Vite codegen plugin that walks the
JSX tree and emits a generated `routes.gen.ts`. That works but adds a
build-time AST pass, a generated file to keep current, and a watcher.

We considered three options:

1. **Hand-written `RouteDefinition` interfaces** (current state) —
   single mental model but two declarations per route, with no
   compiler enforcement that they agree.
2. **Vite codegen plugin** — eliminates the second declaration but
   requires AST parsing of JSX, an output file (`routes.gen.ts`), and
   watch wiring; only works when the plugin is installed.
3. **`createRoute(path, config)` helper** — collapse the JSX route and
   the typed definition into a single TypeScript value. Path, param
   shape, query shape, component, and loader live in one place.

## Decision

Adopt option 3. Add `createRoute<P, Q>(path, config)` to
`@stewie-js/router`. The returned value is callable as a JSX component
(so `<ProjectEditRoute />` works) and carries phantom-type properties
(`__params?: P`, `__query?: Q`, `path: string`) used by `useParams` /
`useQuery` overloads.

```ts
export const ProjectEditRoute = createRoute(
  '/projects/:projectId/edit',
  { component: EditProjectPage, load: projectEditLoader }
);
//  P inferred as { projectId: string } from the path literal

export const LoginRoute = createRoute<{}, { redirect?: string }>(
  '/login',
  { component: LoginPage }
);
//  P explicitly empty, Q explicitly typed
```

Call sites become value-typed:

```ts
const { projectId } = useParams(ProjectEditRoute);
const { redirect } = useQuery(LoginRoute);
```

The legacy generic forms (`useParams<T>()`, `useQuery<T>()`) stay as
overloads for back-compat and inline cases.

`createRoute` is sugar over the existing `<Route>` JSX component. The
runtime emits `<Route path={...} {...config}>{children}</Route>`. The
router-spi does not change — the SPI describes runtime contracts
(history, matcher) and never observed `RouteDefinition` to begin with.

Path-literal inference uses `<const Path extends string>` so `P`
defaults to `PathParams<Path>`. Authors override explicitly when
needed (e.g. empty params with a non-trivial query type).

## Consequences

- Single source of truth per route. Renaming a path segment updates
  the param type for every call site automatically.
- `useParams(route)` is value-typed and self-documenting at the call
  site — the import already says which route it's for.
- No build step, no codegen, no watcher, no generated file. Works in
  any project that imports `@stewie-js/router`, with or without the
  Vite plugin.
- Two ways to declare a route now coexist: `createRoute(...)` and the
  raw JSX `<Route path="..." />`. We treat `createRoute` as the
  recommended path; raw `<Route>` is allowed for inline cases. We may
  deprecate raw `<Route>` later once the canonical app has stabilised
  on `createRoute`.
- `examples/work-queue/src/routes.ts` is migrated from hand-written
  `RouteDefinition` interfaces to `createRoute` calls so the canonical
  app exercises the new path immediately. The `RouteDefinition` type
  stays exported for users who still hand-write definitions.
- Nested-route param composition (a child route automatically
  inheriting an enclosing layout's `:slug`) is *not* part of this
  decision. Each `createRoute` call's `P` reflects only its own path.
  We can layer parent-param composition on later if the canonical app
  shows a need.
- `<Route>` as a JSX component is now load-bearing for two callers
  (raw user JSX and `createRoute` output). Changes to its props need
  to keep both working.
