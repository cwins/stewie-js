// Route definitions — single source of truth for path, param shape, query
// shape, component, and loader for every route in the app.
//
// Each `createRoute(...)` call produces a value that is both a JSX component
// (used in app.tsx as `<ProjectDetailRoute />`) and a type carrier consumed
// at the call site:
//
//   import { ProjectDetailRoute } from '../routes.js';
//   const { projectId } = useParams(ProjectDetailRoute);
//   const { tab } = useQuery(ProjectDetailRoute);
//
// Param shapes are inferred from the path literal via `PathParams`. Query
// shapes are explicit (paths can't tell us query shape) and given as the
// second generic argument when needed.

import { createRoute, type RouteGuard, type TypedRoute } from '@stewie-js/router';
import { lazy } from '@stewie-js/core';
import { DashboardPage } from './pages/DashboardPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { ProjectDetailPage } from './pages/ProjectDetailPage.js';
import { NewProjectPage } from './pages/NewProjectPage.js';
import { EditProjectPage } from './pages/EditProjectPage.js';
import { TaskDetailPage } from './pages/TaskDetailPage.js';
import { ProfileViewPage } from './pages/ProfileViewPage.js';
import { ProfileEditPage } from './pages/ProfileEditPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { AppShellLayout } from './components/AppShell.js';
import { dashboardLoader } from './loaders/dashboard.js';
import { projectsLoader } from './loaders/projects.js';
import { projectDetailLoader } from './loaders/project-detail.js';
import { projectEditLoader } from './loaders/project-edit.js';
import { newProjectLoader } from './loaders/new-project.js';
import { taskDetailLoader } from './loaders/task-detail.js';
import { profileViewLoader } from './loaders/profile-view.js';
import { profileEditLoader } from './loaders/profile-edit.js';
import { getViewer, requireAuth } from './data/mocks/auth.js';

// AdminPage is loaded lazily so its scoped CSS becomes a per-boundary asset.
const AdminPage = lazy(() => import('./pages/AdminPage'));

// Re-export TypedRoute for callers that want to abbreviate (e.g. test helpers).
export type { TypedRoute };

export const AppShellRoute = createRoute('/', { component: AppShellLayout });

export const DashboardRoute = createRoute('.', { component: DashboardPage, load: dashboardLoader });

export const ProjectsRoute = createRoute('/projects', { component: ProjectsPage, load: projectsLoader });

export const NewProjectRoute = createRoute('/projects/new', { component: NewProjectPage, load: newProjectLoader });

export const ProjectEditRoute = createRoute('/projects/:projectId/edit', { component: EditProjectPage, load: projectEditLoader });

export const ProjectDetailRoute = createRoute('/projects/:projectId', { component: ProjectDetailPage, load: projectDetailLoader });

export const TaskDetailRoute = createRoute('/tasks/:taskId', { component: TaskDetailPage, load: taskDetailLoader });

export const AdminRoute = createRoute('/admin', { component: AdminPage, beforeEnter: requireAuth });

// /profile/me resolves the signed-in viewer and redirects to their canonical
// profile URL. The route never renders — the guard always returns a redirect.
const profileMeGuard: RouteGuard = (to) => {
  const viewer = getViewer();
  if (!viewer) return `/login?redirect=${encodeURIComponent(to)}`;
  return `/profile/${viewer.id}`;
};

// Self-edit guard. Authenticated callers viewing their own profile pass
// through; everyone else lands on the read-only view. The API client
// re-checks at the boundary, so this guard is UX, not security.
const requireSelfForProfileEdit: RouteGuard = async (to, from) => {
  const auth = await requireAuth(to, from);
  if (auth !== true) return auth;
  const match = to.match(/^\/profile\/([^/]+)\/edit/);
  if (!match) return '/';
  const targetId = match[1];
  const viewer = getViewer();
  if (!viewer || viewer.id !== targetId) return `/profile/${targetId}`;
  return true;
};

export const ProfileMeRoute = createRoute('/profile/me', { component: ProfileViewPage, beforeEnter: profileMeGuard });

export const ProfileEditRoute = createRoute('/profile/:userId/edit', {
  component: ProfileEditPage,
  load: profileEditLoader,
  beforeEnter: requireSelfForProfileEdit
});

export const ProfileViewRoute = createRoute('/profile/:userId', {
  component: ProfileViewPage,
  load: profileViewLoader,
  beforeEnter: requireAuth
});

export const LoginRoute = createRoute<Record<string, never>, { redirect?: string }>('/login', { component: LoginPage });
