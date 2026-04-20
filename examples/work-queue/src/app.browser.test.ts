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
