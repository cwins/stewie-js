/**
 * Browser tests for the ssr-and-routing example.
 *
 * Runs against a live dev server started by browser-setup.ts (global setup).
 * Uses the `playwright` package directly so we get full page.goto / navigation.
 * Assertions use Playwright's native locator API (waitFor, textContent, count)
 * rather than @playwright/test matchers, so Vitest's own expect remains the
 * only assertion library.
 *
 * Seed data (src/data.json):
 *   Projects: "Work Tasks" (p1), "Personal Goals" (p2)
 *   Tasks on p1: "Review Q1 Reports" (t1), "Email Marketing Team" (t2)
 *   Tasks on p2: "Run 5K" (t3)
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
  // Fresh page per test — isolates navigation state and client store
  page = await browser.newPage();
  await page.goto(BROWSER_TEST_URL);
});

// ---------------------------------------------------------------------------
// Helpers — thin wrappers over Playwright's locator API
// ---------------------------------------------------------------------------

async function visible(testId: string): Promise<void> {
  await page.getByTestId(testId).waitFor({ state: 'visible' });
}

async function hidden(testId: string): Promise<void> {
  await page.getByTestId(testId).waitFor({ state: 'hidden' });
}

async function text(testId: string): Promise<string> {
  return (await page.getByTestId(testId).textContent()) ?? '';
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

describe('Dashboard', () => {
  it('renders project cards via SSR', async () => {
    await visible('project-grid');
    await visible('project-card-p1');
    await visible('project-card-p2');
  });

  it('shows active task counts on project cards', async () => {
    // p1 has 2 incomplete tasks, p2 has 1
    expect(await text('project-card-p1')).toContain('2 active task');
    expect(await text('project-card-p2')).toContain('1 active task');
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('Navigation', () => {
  it('clicking a project card navigates to project detail', async () => {
    await page.getByTestId('project-card-p1').click();
    await visible('project-detail-p1');
    expect(await text('project-name')).toContain('Work Tasks');
  });

  it('back button returns to dashboard', async () => {
    await page.getByTestId('project-card-p1').click();
    await visible('project-detail-p1');
    await page.getByRole('button', { name: '← Back' }).click();
    await visible('dashboard');
  });

  it('direct URL navigation to a project works (SSR)', async () => {
    await page.goto(`${BROWSER_TEST_URL}/project/p2`);
    await visible('project-detail-p2');
    expect(await text('project-name')).toContain('Personal Goals');
  });
});

// ---------------------------------------------------------------------------
// Project management
// ---------------------------------------------------------------------------

describe('Create project', () => {
  it('creates a project and shows it on the dashboard', async () => {
    await page.getByTestId('new-project-card').click();
    await visible('create-project');

    await page.getByTestId('project-name-input').fill('Browser Test Project');
    await page.getByTestId('create-project-submit').click();

    await visible('dashboard');
    // Scope to the project grid to avoid devtools panel text matches
    await page.getByTestId('project-grid').getByText('Browser Test Project').waitFor({ state: 'visible' });
  });

  it('does not create a project with an empty name', async () => {
    await page.getByTestId('new-project-card').click();
    await page.getByTestId('create-project-submit').click();
    await visible('create-project');
  });
});

// ---------------------------------------------------------------------------
// Task management
// ---------------------------------------------------------------------------

describe('Create task', () => {
  it('adds a task to a project and shows it in the list', async () => {
    await page.getByTestId('project-card-p1').click();
    await page.getByTestId('add-task-btn').click();

    await visible('create-task');
    await page.getByTestId('task-title-input').fill('Browser Test Task');
    await page.getByTestId('create-task-submit').click();

    await visible('task-list');
    // Scope to the task list to avoid devtools panel text matches
    await page.getByTestId('task-list').getByText('Browser Test Task').waitFor({ state: 'visible' });
  });
});

describe('Edit task', () => {
  it('opens the edit sheet when a task row is clicked', async () => {
    await page.getByTestId('project-card-p1').click();
    await page.getByTestId('task-row-p1-t1').click();
    await visible('edit-task');
    await visible('edit-task-title-input');
  });

  it('saves changes and updates the task title in the list', async () => {
    await page.getByTestId('project-card-p1').click();
    await page.getByTestId('task-row-p1-t1').click();

    await page.getByTestId('edit-task-title-input').fill('Updated Title');
    await page.getByTestId('edit-task-submit').click();

    await hidden('edit-task');
    // Scope to the task row to avoid devtools panel text matches
    await page.getByTestId('task-row-p1-t1').getByText('Updated Title').waitFor({ state: 'visible' });
  });
});

describe('Delete task', () => {
  it('removes the task from the list after deletion', async () => {
    await page.getByTestId('project-card-p1').click();
    await visible('task-row-p1-t2');

    await page.getByTestId('task-row-p1-t2').click();
    await page.getByTestId('delete-task-btn').click();

    await hidden('task-row-p1-t2');
  });
});
