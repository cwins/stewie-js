// SSR render tests for the Work Queue app.
//
// Tests verify that the server-rendered HTML contains expected content for each
// route. These run without a browser — the app is rendered to string and the
// output is inspected directly.
//
// Teaching point: SSR tests are the fastest way to verify route loader data,
// navigation structure, and hydration-compatible HTML output.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderApp } from './app.js';
import { _resetToSeed } from './data/mocks/repo.js';
import { signIn, signOut } from './data/mocks/auth.js';

beforeEach(() => {
  _resetToSeed();
  signOut();
});

describe('SSR — dashboard (/)', () => {
  it('renders the navbar', async () => {
    const { html } = await renderApp('/');
    expect(html).toContain('class="navbar"');
    expect(html).toContain('Work Queue');
  });

  it('renders all 3 project cards from seed data', async () => {
    const { html } = await renderApp('/');
    expect(html).toContain('Platform Migration');
    expect(html).toContain('Design System');
    expect(html).toContain('Q2 Growth Campaign');
  });

  it('renders stats grid with correct project count', async () => {
    const { html } = await renderApp('/');
    expect(html).toContain('data-testid="stat-projects"');
    // 3 active projects from seed
    expect(html).toMatch(/stat-projects[^>]*>.*?<span[^>]*>3<\/span>/s);
  });

  it('injects hydration state script', async () => {
    const { stateScript } = await renderApp('/');
    expect(stateScript).toContain('__STEWIE_STATE__');
  });
});

describe('SSR — projects list (/projects)', () => {
  it('renders project list items for all 3 projects', async () => {
    const { html } = await renderApp('/projects');
    expect(html).toContain('data-testid="project-list"');
    expect(html).toContain('Platform Migration');
    expect(html).toContain('Design System');
    expect(html).toContain('Q2 Growth Campaign');
  });

  it('renders task count for each project', async () => {
    const { html } = await renderApp('/projects');
    expect(html).toContain('5 tasks'); // proj_1
    expect(html).toContain('4 tasks'); // proj_2
    expect(html).toContain('3 tasks'); // proj_3
  });

  it('renders new project link', async () => {
    const { html } = await renderApp('/projects');
    expect(html).toContain('href="/projects/new"');
  });
});

describe('SSR — project detail (/projects/:projectId)', () => {
  it('renders the project name', async () => {
    const { html } = await renderApp('/projects/proj_1');
    expect(html).toContain('data-testid="project-name"');
    expect(html).toContain('Platform Migration');
  });

  it('renders task rows for the project', async () => {
    const { html } = await renderApp('/projects/proj_1');
    expect(html).toContain('data-testid="task-row-task_1"');
    expect(html).toContain('data-testid="task-row-task_3"');
    expect(html).toContain('Audit existing API surface');
    expect(html).toContain('Migrate authentication service');
  });

  it('groups tasks by status', async () => {
    const { html } = await renderApp('/projects/proj_1');
    expect(html).toContain('data-testid="tasks-in-progress"');
    expect(html).toContain('data-testid="tasks-todo"');
    expect(html).toContain('data-testid="tasks-done"');
  });

  it('renders proj_2 with its tasks', async () => {
    const { html } = await renderApp('/projects/proj_2');
    expect(html).toContain('Design System');
    expect(html).toContain('Define token system');
  });
});

describe('SSR — new project page (/projects/new)', () => {
  it('renders the new project form', async () => {
    const { html } = await renderApp('/projects/new');
    expect(html).toContain('data-testid="new-project-form"');
    expect(html).toContain('data-testid="project-name-input"');
    expect(html).toContain('data-testid="create-project-submit"');
  });
});

describe('SSR — edit project page (/projects/:projectId/edit)', () => {
  it('renders the edit form pre-populated with project data', async () => {
    const { html } = await renderApp('/projects/proj_1/edit');
    expect(html).toContain('data-testid="edit-project-page"');
    expect(html).toContain('data-testid="edit-project-form"');
    // Input is pre-populated with the existing project name
    expect(html).toContain('Platform Migration');
  });

  it('renders save and cancel buttons', async () => {
    const { html } = await renderApp('/projects/proj_1/edit');
    expect(html).toContain('data-testid="save-project-btn"');
    expect(html).toContain('href="/projects/proj_1"');
  });

  it('renders the danger zone for archive', async () => {
    const { html } = await renderApp('/projects/proj_1/edit');
    expect(html).toContain('data-testid="danger-zone"');
    expect(html).toContain('data-testid="archive-btn"');
  });
});

describe('SSR — task detail page (/tasks/:taskId)', () => {
  it('renders the task title and project back-link', async () => {
    const { html } = await renderApp('/tasks/task_1');
    expect(html).toContain('data-testid="task-detail-task_1"');
    expect(html).toContain('Audit existing API surface');
    expect(html).toContain('href="/projects/proj_1"');
  });

  it('renders the edit form', async () => {
    const { html } = await renderApp('/tasks/task_1');
    expect(html).toContain('data-testid="edit-task-form"');
    expect(html).toContain('data-testid="task-title-input"');
    expect(html).toContain('data-testid="task-status-select"');
  });
});

describe('SSR — login page (/login)', () => {
  it('renders the login form', async () => {
    const { html } = await renderApp('/login');
    expect(html).toContain('data-testid="login-page"');
    expect(html).toContain('data-testid="login-form"');
    expect(html).toContain('data-testid="username-input"');
    expect(html).toContain('data-testid="login-submit"');
  });
});

describe('SSR — admin page (/admin) with auth guard', () => {
  it('redirects to /login when not authenticated', async () => {
    // The requireAuth guard returns false for unauthenticated requests.
    // renderApp catches the RedirectError and returns a redirect result.
    const result = await renderApp('/admin');
    expect(result.redirect).toMatch(/^\/login/);
  });
});

describe('SSR — profile pages (/profile/*)', () => {
  it('/profile/me redirects to /login when unauthenticated', async () => {
    const result = await renderApp('/profile/me');
    expect(result.redirect).toMatch(/^\/login\?redirect=/);
  });

  it('/profile/me redirects to the viewer canonical URL when signed in', async () => {
    signIn('alice');
    const result = await renderApp('/profile/me');
    expect(result.redirect).toBe('/profile/user_alice');
  });

  it('renders the self view with email and timezone when viewing own profile', async () => {
    signIn('alice');
    const { html } = await renderApp('/profile/user_alice');
    expect(html).toContain('data-testid="profile-view-user_alice"');
    expect(html).toContain('Alice Chen');
    expect(html).toContain('alice@example.com');
    expect(html).toContain('America/Los_Angeles');
    expect(html).toContain('data-testid="edit-profile-link"');
  });

  it('renders the public view without sensitive fields when viewing another user', async () => {
    signIn('bob');
    const { html } = await renderApp('/profile/user_alice');
    expect(html).toContain('Alice Chen');
    // Sensitive fields are absent on the public arm.
    expect(html).not.toContain('alice@example.com');
    expect(html).not.toContain('America/Los_Angeles');
    expect(html).toContain('data-testid="profile-contact-hidden"');
    expect(html).not.toContain('data-testid="edit-profile-link"');
  });

  it('redirects /profile/:userId/edit to the view page when the viewer is not the target', async () => {
    signIn('bob');
    const result = await renderApp('/profile/user_alice/edit');
    expect(result.redirect).toBe('/profile/user_alice');
  });

  it('renders the edit form when the viewer is the target', async () => {
    signIn('alice');
    const { html } = await renderApp('/profile/user_alice/edit');
    expect(html).toContain('data-testid="profile-edit-page"');
    expect(html).toContain('data-testid="edit-profile-form"');
    expect(html).toContain('data-testid="save-profile-btn"');
    expect(html).toContain('Alice Chen');
  });
});
