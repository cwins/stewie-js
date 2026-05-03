// typed-routes.ts — type-only utilities for typed route params and query.
//
// These types let route definitions live in a separate file (hand-written or
// emitted by a codegen plugin) and be consumed at call sites via:
//
//   const { projectId } = useParams<ProjectDetailRoute>();
//   const { tab }       = useQuery<ProjectDetailRoute>();
//
// where ProjectDetailRoute is a RouteDefinition that bundles the route's
// param shape and query shape together — analogous to Apollo's generated
// query types that carry both result and variables.
//
// The same shape applies whether the file is hand-written or generated: a
// plugin (future) can emit definitions like the one below, and a project
// without the plugin can hand-author the same file with no API difference.

/**
 * A bundled definition of a route's param and query shapes.
 *
 * Authors can hand-write or codegen these as named types and pass them as the
 * generic to `useParams<T>()` / `useQuery<T>()`. Bundling both shapes in one
 * type means a single import per route at the call site.
 *
 * @example
 * import type { RouteDefinition, PathParams } from '@stewie-js/router';
 *
 * export interface ProjectDetailRoute extends RouteDefinition<
 *   PathParams<'/projects/:projectId'>,
 *   { tab?: string }
 * > {}
 */
export interface RouteDefinition<
  TParams extends Record<string, string> = Record<string, string>,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>
> {
  params: TParams;
  query: TQuery;
}

/**
 * Extract `:param` segments from a path string into a `Record<param, string>`.
 *
 * Stewie's matcher does not have optional params, so every extracted key is a
 * required `string`.
 *
 * @example
 * type P = PathParams<'/projects/:projectId/tasks/:taskId'>;
 * // → { projectId: string; taskId: string }
 */
export type PathParams<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof PathParams<`/${Rest}`>]: string }
  : P extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>;

/**
 * Resolve the params shape from a generic argument.
 *
 * If the argument is a `RouteDefinition` (has a `params` property), unwrap it.
 * Otherwise treat the argument itself as the param shape (back-compat with
 * `useParams<{ projectId: string }>()`).
 */
export type ParamsOf<T> = T extends { params: infer P } ? P : T;

/**
 * Resolve the query shape from a generic argument.
 *
 * If the argument is a `RouteDefinition` (has a `query` property), unwrap it.
 * Otherwise treat the argument itself as the query shape (back-compat with
 * `useQuery<{ redirect?: string }>()`).
 */
export type QueryOf<T> = T extends { query: infer Q } ? Q : T;
