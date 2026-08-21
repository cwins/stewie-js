/**
 * Browser tests for the Work Queue canonical example.
 *
 * Runs against a production build started by browser-setup.ts.
 * Uses Playwright directly (not @playwright/test) — assertions use Vitest's
 * expect alongside Playwright's native locator API.
 *
 * Seed data:
 *   Projects: "Platform Migration" (proj_1), "Design System" (proj_2), "Q2 Growth Campaign" (proj_3)
 *   Tasks on proj_1: 5 tasks (2 done, 1 in-progress, 2 todo)
 *   Tasks on proj_2: 4 tasks
 *   Tasks on proj_3: 3 tasks
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { BROWSER_TEST_URL } from '../vitest.browser.config.js';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

beforeEach(async () => {
  page = await browser.newPage();
  await page.goto(BROWSER_TEST_URL);
});

// Helpers
async function visible(testId: string): Promise<void> {
  await page.getByTestId(testId).waitFor({ state: 'visible' });
}

async function text(testId: string): Promise<string> {
  return (await page.getByTestId(testId).textContent()) ?? '';
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

describe('Dashboard', () => {
  it('renders SSR stats grid', async () => {
    await visible('stats-grid');
    await visible('stat-projects');
    expect(await text('stat-projects')).toContain('3');
  });

  it('renders project cards from seed data', async () => {
    await visible('project-grid');
    await page.getByText('Platform Migration').waitFor({ state: 'visible' });
    await page.getByText('Design System').waitFor({ state: 'visible' });
    await page.getByText('Q2 Growth Campaign').waitFor({ state: 'visible' });
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('Navigation', () => {
  it('clicking a project card navigates to project detail', async () => {
    await page.getByTestId('project-card-proj_1').click();
    await visible(`project-detail-proj_1`);
    expect(await text('project-name')).toContain('Platform Migration');
  });

  it('direct URL to project detail works (SSR)', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_2`);
    await visible('project-detail-proj_2');
    expect(await text('project-name')).toContain('Design System');
  });

  it('back link returns to projects list', async () => {
    await page.getByTestId('project-card-proj_1').click();
    await page.getByTestId('back-link').click();
    await visible('projects-page');
  });

  it('projects nav link works from dashboard', async () => {
    await page.getByRole('link', { name: 'Projects' }).click();
    await visible('projects-page');
    await visible('project-list');
  });
});

// ---------------------------------------------------------------------------
// Projects list
// ---------------------------------------------------------------------------

describe('Projects list', () => {
  it('shows all 3 projects with task counts', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects`);
    await visible('project-list');
    await page.getByTestId('project-list-item-proj_1').waitFor({ state: 'visible' });
    const item1 = await page.getByTestId('project-list-item-proj_1').textContent();
    expect(item1).toContain('5 tasks');
  });
});

// ---------------------------------------------------------------------------
// Project detail — task management
// ---------------------------------------------------------------------------

describe('Create task', () => {
  it('adds a task via inline form and shows it in the list', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1`);
    await page.getByTestId('add-task-btn').click();
    await visible('create-task-form');
    await page.getByTestId('create-task-title').fill('Browser Test Task');
    await page.getByTestId('create-task-submit').click();
    await page.getByText('Browser Test Task').waitFor({ state: 'visible' });
  });
});

describe('Edit task', () => {
  it('opens the edit sheet when a task row is clicked', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1`);
    await page.getByTestId('task-row-task_3').click();
    await visible('task-sheet');
    await visible('edit-task-title');
  });

  it('saves changes and updates the task title', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1`);
    await page.getByTestId('task-row-task_3').click();
    await page.getByTestId('edit-task-title').fill('Updated Title');
    await page.getByTestId('edit-task-save').click();
    await page.getByText('Updated Title').waitFor({ state: 'visible' });
  });
});

describe('Delete task', () => {
  it('removes the task from the list after deletion', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1`);
    await page.getByTestId('task-row-task_4').click();
    await visible('task-sheet');
    await page.getByTestId('delete-task-btn').click();
    await page.getByTestId('task-row-task_4').waitFor({ state: 'hidden' });
  });
});

// ---------------------------------------------------------------------------
// New project
// ---------------------------------------------------------------------------

describe('Create project', () => {
  it('creates a project and navigates to its detail page', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects`);
    await page.getByText('New Project').first().click();
    await visible('new-project-form');
    await page.getByTestId('project-name-input').fill('Browser Test Project');
    await page.getByTestId('create-project-submit').click();
    // After create, navigates to the new project's detail page
    await page.getByText('Browser Test Project').waitFor({ state: 'visible' });
  });

  it('does not submit with empty name', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/new`);
    // With an empty name, the submit button is disabled — form validity guards submission.
    await visible('new-project-form');
    expect(await page.getByTestId('create-project-submit').isDisabled()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Status filter — query-param view state
// ---------------------------------------------------------------------------

/**
 * proj_1 seed: 5 tasks — 2 done, 1 in_progress, 2 todo.
 *
 * These cover the query-param path that no other browser test reaches. The
 * filter is applied with `router.setQuery()`, so the route does not re-mount:
 * the page must react purely through its `useQuery()` view. A regression that
 * makes `useQuery()` snapshot at setup shows up here as a filter that changes
 * the URL but not the list.
 */
describe('Task status filter', () => {
  const rows = () => page.locator('[data-testid^="task-row-"]');

  it('applies ?status= from a direct URL (server-rendered)', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1?status=done`);
    await visible('task-filter-bar');
    expect(await rows().count()).toBe(2);
    expect(await text('task-filter-count')).toBe('2 of 5');
    await page.getByTestId('tasks-todo').waitFor({ state: 'detached' });
  });

  it('clicking a filter updates the list without re-navigating', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1`);
    await visible('task-filter-bar');
    expect(await rows().count()).toBe(5);

    // Survives only if the document is never reloaded.
    await page.evaluate(() => {
      (window as unknown as { __noReload?: boolean }).__noReload = true;
    });

    await page.getByTestId('task-filter-todo').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="task-row-"]').length === 2);

    expect(page.url()).toContain('status=todo');
    expect(await text('task-filter-count')).toBe('2 of 5');
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  });

  it('switching between two filters keeps the list in sync', async () => {
    // Query-only → query-only. The route never re-mounts on either move, so
    // this is the case a setup-time snapshot gets wrong.
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1`);
    await visible('task-filter-bar');

    await page.getByTestId('task-filter-done').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="task-row-"]').length === 2);
    expect(page.url()).toContain('status=done');

    await page.getByTestId('task-filter-in_progress').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="task-row-"]').length === 1);
    expect(page.url()).toContain('status=in_progress');
    expect(await text('task-filter-count')).toBe('1 of 5');
  });

  it('choosing All removes the query param', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1?status=done`);
    await visible('task-filter-bar');

    await page.getByTestId('task-filter-all').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="task-row-"]').length === 5);
    expect(page.url()).not.toContain('status=');
  });

  it('falls back to All for an unrecognised status', async () => {
    await page.goto(`${BROWSER_TEST_URL}/projects/proj_1?status=banana`);
    await visible('task-filter-bar');
    expect(await rows().count()).toBe(5);
    expect(await page.getByTestId('task-filter-all').getAttribute('aria-pressed')).toBe('true');
  });

  it('filtering does not push history entries', async () => {
    // setQuery defaults to replaceState, so repeated filtering does not bury
    // the page the user arrived from under a stack of filter states. Back goes
    // back to the projects list, not to the previous filter.
    await page.goto(`${BROWSER_TEST_URL}/projects`);
    await page.getByTestId('project-list-item-proj_1').click();
    await visible('task-filter-bar');

    await page.getByTestId('task-filter-todo').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="task-row-"]').length === 2);
    await page.getByTestId('task-filter-done').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid^="task-row-"]').length === 2);
    expect(page.url()).toContain('status=done');

    await page.goBack();
    await visible('project-list');
  });
});
