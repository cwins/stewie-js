// @vitest-environment happy-dom
/**
 * Type-level + runtime tests for typed route params and query.
 *
 * Type assertions use `expectTypeOf` so a regression breaks the test file at
 * compile time, not just at runtime.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';
import { jsx, reactiveScope, mount } from '@stewie-js/core';
import { Router, Route, createRoute, Outlet } from './components.js';
import { useParams, useQuery } from './hooks.js';
import type { RouteDefinition, PathParams, ParamsOf, QueryOf, TypedRoute } from './typed-routes.js';

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

  it('ParamsOf / QueryOf unwrap a TypedRoute', () => {
    type R = TypedRoute<{ id: string }, { tab?: string }>;
    expectTypeOf<ParamsOf<R>>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<QueryOf<R>>().toEqualTypeOf<{ tab?: string }>();
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

// ---------------------------------------------------------------------------
// createRoute — single source of truth for path + types + runtime config
// ---------------------------------------------------------------------------

describe('createRoute', () => {
  it('infers params from the path literal', () => {
    function PageImpl() {
      return jsx('span', { children: 'page' });
    }
    const ProjectRoute = createRoute('/projects/:projectId', { component: PageImpl });
    expectTypeOf<ParamsOf<typeof ProjectRoute>>().toEqualTypeOf<{ projectId: string }>();
  });

  it('accepts explicit P and Q generics for empty-params + query routes', () => {
    function LoginImpl() {
      return jsx('span', { children: 'login' });
    }
    const LoginRoute = createRoute<Record<string, never>, { redirect?: string }>('/login', { component: LoginImpl });
    expectTypeOf<ParamsOf<typeof LoginRoute>>().toEqualTypeOf<Record<string, never>>();
    expectTypeOf<QueryOf<typeof LoginRoute>>().toEqualTypeOf<{ redirect?: string }>();
  });

  it('mounts via JSX inside <Router> and matches the URL', () => {
    let captured: { projectId: string } | undefined;
    function Page() {
      captured = useParams(ProjectRoute);
      return jsx('span', { children: 'page' });
    }
    const ProjectRoute = createRoute('/projects/:projectId', { component: Page });

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/projects/9',
          children: [jsx(ProjectRoute as never, {})]
        }),
        container
      );
    });
    expect(captured).toEqual({ projectId: '9' });
  });

  it('useParams(route) returns the correctly-typed params at the call site', () => {
    let captured: { projectId: string } | undefined;
    const ProjectRoute = createRoute('/projects/:projectId', { component: Page });
    function Page() {
      const params = useParams(ProjectRoute);
      // Type assertion: params is { projectId: string }, not Record<string, string>.
      expectTypeOf<typeof params>().toEqualTypeOf<{ projectId: string }>();
      captured = params;
      return jsx('span', { children: 'page' });
    }

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/projects/123',
          children: [jsx(ProjectRoute as never, {})]
        }),
        container
      );
    });
    expect(captured).toEqual({ projectId: '123' });
  });

  it('useQuery(route) returns the correctly-typed query at the call site', () => {
    let captured: { redirect?: string } | undefined;
    const LoginRoute = createRoute<Record<string, never>, { redirect?: string }>('/login', { component: Page });
    function Page() {
      const q = useQuery(LoginRoute);
      expectTypeOf<typeof q>().toEqualTypeOf<{ redirect?: string }>();
      captured = q;
      return jsx('span', { children: 'login' });
    }

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/login?redirect=/dashboard',
          children: [jsx(LoginRoute as never, {})]
        }),
        container
      );
    });
    expect(captured).toEqual({ redirect: '/dashboard' });
  });

  it('supports nested layout routes via JSX children', () => {
    let layoutMounted = false;
    let pageMounted = false;
    function AppShell() {
      layoutMounted = true;
      return jsx('div', { class: 'shell', children: jsx(Outlet as never, {}) });
    }
    function ProjectsPage() {
      pageMounted = true;
      return jsx('span', { children: 'projects' });
    }

    const AppShellRoute = createRoute('/', { component: AppShell });
    const ProjectsRoute = createRoute('/projects', { component: ProjectsPage });

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/projects',
          children: [
            jsx(AppShellRoute as never, {
              children: [jsx(ProjectsRoute as never, {})]
            })
          ]
        }),
        container
      );
    });
    expect(layoutMounted).toBe(true);
    expect(pageMounted).toBe(true);
    expect(container.querySelector('.shell')).not.toBeNull();
    expect(container.textContent).toContain('projects');
  });

  it('mixing raw <Route> and createRoute() in the same tree works', () => {
    function HomePage() {
      return jsx('span', { children: 'home' });
    }
    function AboutPage() {
      return jsx('span', { children: 'about' });
    }
    const HomeRoute = createRoute('/', { component: HomePage });

    const container = document.createElement('div');
    reactiveScope(() => {
      mount(
        jsx(Router as never, {
          initialUrl: '/about',
          children: [jsx(HomeRoute as never, {}), jsx(Route as never, { path: '/about', component: AboutPage })]
        }),
        container
      );
    });
    expect(container.textContent).toContain('about');
  });
});
