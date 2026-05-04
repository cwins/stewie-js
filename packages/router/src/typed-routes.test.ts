// @vitest-environment happy-dom
/**
 * Type-level + runtime tests for typed route params and query.
 *
 * Type assertions use `expectTypeOf` so a regression breaks the test file at
 * compile time, not just at runtime.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import { jsx, reactiveScope, mount } from '@stewie-js/core';
import { Router, Route } from './components.js';
import { useParams, useQuery } from './hooks.js';
import type { RouteDefinition, PathParams, ParamsOf, QueryOf } from './typed-routes.js';

// ---------------------------------------------------------------------------
// PathParams — template literal extraction
// ---------------------------------------------------------------------------

describe('PathParams<P>', () => {
  it('extracts a single param', () => {
    expectTypeOf<PathParams<'/projects/:projectId'>>().toEqualTypeOf<{ projectId: string }>();
  });

  it('extracts multiple params', () => {
    expectTypeOf<PathParams<'/projects/:projectId/tasks/:taskId'>>().toEqualTypeOf<{
      projectId: string;
      taskId: string;
    }>();
  });

  it('returns empty record for a path with no params', () => {
    expectTypeOf<PathParams<'/about'>>().toEqualTypeOf<Record<string, never>>();
  });
});

// ---------------------------------------------------------------------------
// ParamsOf / QueryOf — unwrap RouteDefinition or pass-through
// ---------------------------------------------------------------------------

describe('ParamsOf<T> / QueryOf<T>', () => {
  it('unwraps params from a RouteDefinition', () => {
    interface R extends RouteDefinition<{ id: string }, { tab?: string }> {}
    expectTypeOf<ParamsOf<R>>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<QueryOf<R>>().toEqualTypeOf<{ tab?: string }>();
  });

  it('passes through bare param/query shapes (back-compat)', () => {
    expectTypeOf<ParamsOf<{ id: string }>>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<QueryOf<{ tab?: string }>>().toEqualTypeOf<{ tab?: string }>();
  });
});

// ---------------------------------------------------------------------------
// useParams<T>() / useQuery<T>() — runtime + type integration
// ---------------------------------------------------------------------------

describe('useParams / useQuery — RouteDefinition', () => {
  interface ProjectDetailRoute extends RouteDefinition<PathParams<'/projects/:projectId'>, { tab?: string }> {}

  it('useParams<RouteDef>() returns the correctly-typed params at runtime', () => {
    let captured: { projectId: string } | undefined;
    function Page() {
      captured = useParams<ProjectDetailRoute>();
      return jsx('span', { children: 'page' });
    }
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/projects/42',
          children: [jsx(Route as never, { path: '/projects/:projectId', component: Page })]
        }),
        container
      );
    });
    expect(captured).toEqual({ projectId: '42' });
  });

  it('useQuery<RouteDef>() returns the correctly-typed query at runtime', () => {
    let captured: { tab?: string } | undefined;
    function Page() {
      captured = useQuery<ProjectDetailRoute>();
      return jsx('span', { children: 'page' });
    }
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/projects/42?tab=files',
          children: [jsx(Route as never, { path: '/projects/:projectId', component: Page })]
        }),
        container
      );
    });
    expect(captured).toEqual({ tab: 'files' });
  });

  it('useParams<{ shape }>() back-compat keeps working', () => {
    let captured: { projectId: string } | undefined;
    function Page() {
      captured = useParams<{ projectId: string }>();
      return jsx('span', { children: 'page' });
    }
    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/projects/7',
          children: [jsx(Route as never, { path: '/projects/:projectId', component: Page })]
        }),
        container
      );
    });
    expect(captured).toEqual({ projectId: '7' });
  });
});
