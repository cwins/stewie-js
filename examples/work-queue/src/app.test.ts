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
import { _resetToSeed } from './data/repo.js';

beforeEach(() => {
  _resetToSeed();
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
