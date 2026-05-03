// Route definitions — typed param/query shapes for each app route.
//
// This file is hand-written today; a future Stewie Vite codegen pass will
// emit the same shape automatically by walking the route tree in app.tsx.
// Either way, call sites import a single named type per route:
//
//   const { projectId } = useParams<ProjectDetailRoute>();
//   const { tab } = useQuery<ProjectDetailRoute>();
//
// Each definition extends `RouteDefinition<TParams, TQuery>` so both shapes
// travel together — analogous to a generated Apollo query type carrying both
// result and variables.

import type { RouteDefinition, PathParams } from '@stewie-js/router';

export interface ProjectDetailRoute extends RouteDefinition<PathParams<'/projects/:projectId'>> {}

export interface ProjectEditRoute extends RouteDefinition<PathParams<'/projects/:projectId/edit'>> {}

export interface TaskDetailRoute extends RouteDefinition<PathParams<'/tasks/:taskId'>> {}

export interface LoginRoute
  extends RouteDefinition<Record<string, never>, { redirect?: string }> {}
