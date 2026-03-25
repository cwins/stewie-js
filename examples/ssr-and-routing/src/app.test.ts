// @vitest-environment happy-dom
//
// Tests for the ssr-and-routing example.
//
// Covers:
//   1. SSR output — renderApp(url) produces correct HTML strings per route
//   2. Hydration — hydrate() picks up __STEWIE_STATE__ and App reads it
//   3. Client-side DOM — mount() renders the app tree

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderApp, App } from './app.js'
import type { AppData } from './app.js'
import { hydrate, mount, jsx, createRoot } from '@stewie-js/core'
import type { Component, Disposer } from '@stewie-js/core'

// ---------------------------------------------------------------------------
// SSR: Dashboard route
// ---------------------------------------------------------------------------

describe('renderApp("/") — Dashboard SSR', () => {
  it('renders the Projects heading', async () => {
    const { html } = await renderApp('/')
    expect(html).toContain('Projects')
  })

  it('renders project cards for each seed project', async () => {
    const { html } = await renderApp('/')
    expect(html).toContain('Work Tasks')
    expect(html).toContain('Personal Goals')
  })

  it('renders a project-card testid for p1', async () => {
    const { html } = await renderApp('/')
    expect(html).toContain('project-card-p1')
  })

  it('renders a project-card testid for p2', async () => {
    const { html } = await renderApp('/')
    expect(html).toContain('project-card-p2')
  })

  it('renders the new-project card', async () => {
    const { html } = await renderApp('/')
    expect(html).toContain('new-project-card')
  })

  it('renders the project grid', async () => {
    const { html } = await renderApp('/')
    expect(html).toContain('project-grid')
  })

  it('returns stateScript containing __STEWIE_STATE__ with appData', async () => {
    const { html, stateScript } = await renderApp('/')
    expect(html).not.toContain('__STEWIE_STATE__')
    expect(stateScript).toContain('__STEWIE_STATE__')
    expect(stateScript).toContain('appData')
    expect(stateScript).toContain('Work Tasks')
  })
})

// ---------------------------------------------------------------------------
// SSR: Project Detail route
// ---------------------------------------------------------------------------

describe('renderApp("/project/p1") — Project Detail SSR', () => {
  it('renders the project name', async () => {
    const { html } = await renderApp('/project/p1')
    expect(html).toContain('Work Tasks')
  })

  it('renders the project-detail testid', async () => {
    const { html } = await renderApp('/project/p1')
    expect(html).toContain('project-detail-p1')
  })

  it('renders task rows for tasks in p1', async () => {
    const { html } = await renderApp('/project/p1')
    expect(html).toContain('task-row-t1')
    expect(html).toContain('task-row-t2')
  })

  it('renders task titles', async () => {
    const { html } = await renderApp('/project/p1')
    expect(html).toContain('Review Q1 Reports')
    expect(html).toContain('Email Marketing Team')
  })

  it('does not render task rows from other projects', async () => {
    const { html } = await renderApp('/project/p1')
    // t3 (Run 5K) belongs to p2 — its task-row should not appear in the rendered view.
    // Note: "Run 5K" may still appear inside __STEWIE_STATE__ JSON, so we check
    // for the task-row element specifically.
    expect(html).not.toContain('task-row-t3')
  })

  it('renders a due date badge for t1', async () => {
    const { html } = await renderApp('/project/p1')
    expect(html).toContain('task-badge-t1')
  })

  it('renders "No date" badge for t2 (null dueDate)', async () => {
    const { html } = await renderApp('/project/p1')
    expect(html).toContain('No date')
  })

  it('renders the back button', async () => {
    const { html } = await renderApp('/project/p1')
    expect(html).toContain('back-btn')
  })
})

describe('renderApp("/project/p2") — Project Detail p2 SSR', () => {
  it('renders Personal Goals', async () => {
    const { html } = await renderApp('/project/p2')
    expect(html).toContain('Personal Goals')
  })

  it('renders the Run 5K task', async () => {
    const { html } = await renderApp('/project/p2')
    expect(html).toContain('Run 5K')
    expect(html).toContain('task-row-t3')
  })
})

// ---------------------------------------------------------------------------
// SSR: Create Project form
// ---------------------------------------------------------------------------

describe('renderApp("/project/create") — Create Project form SSR', () => {
  it('renders the create-project testid', async () => {
    const { html } = await renderApp('/project/create')
    expect(html).toContain('create-project')
  })

  it('renders the project name input', async () => {
    const { html } = await renderApp('/project/create')
    expect(html).toContain('project-name-input')
  })

  it('renders the create project form', async () => {
    const { html } = await renderApp('/project/create')
    expect(html).toContain('create-project-form')
  })

  it('renders the submit button', async () => {
    const { html } = await renderApp('/project/create')
    expect(html).toContain('create-project-submit')
  })

  it('renders the New Project heading', async () => {
    const { html } = await renderApp('/project/create')
    expect(html).toContain('New Project')
  })
})

// ---------------------------------------------------------------------------
// SSR: Create Task form
// ---------------------------------------------------------------------------

describe('renderApp("/project/p1/task/create") — Create Task form SSR', () => {
  it('renders the create-task testid', async () => {
    const { html } = await renderApp('/project/p1/task/create')
    expect(html).toContain('create-task')
  })

  it('renders the task title input', async () => {
    const { html } = await renderApp('/project/p1/task/create')
    expect(html).toContain('task-title-input')
  })

  it('renders the task description textarea', async () => {
    const { html } = await renderApp('/project/p1/task/create')
    expect(html).toContain('task-desc-input')
  })

  it('renders the due date input', async () => {
    const { html } = await renderApp('/project/p1/task/create')
    expect(html).toContain('task-due-input')
  })

  it('renders the create-task-form', async () => {
    const { html } = await renderApp('/project/p1/task/create')
    expect(html).toContain('create-task-form')
  })

  it('renders the New Task heading', async () => {
    const { html } = await renderApp('/project/p1/task/create')
    expect(html).toContain('New Task')
  })
})

// ---------------------------------------------------------------------------
// SSR: Edit Task form
// ---------------------------------------------------------------------------

describe('renderApp("/project/p1/task/t1") — Edit Task form SSR', () => {
  it('renders the edit-task testid', async () => {
    const { html } = await renderApp('/project/p1/task/t1')
    expect(html).toContain('edit-task')
  })

  it('renders the edit task form', async () => {
    const { html } = await renderApp('/project/p1/task/t1')
    expect(html).toContain('edit-task-form')
  })

  it('renders the title input with existing task title', async () => {
    const { html } = await renderApp('/project/p1/task/t1')
    expect(html).toContain('edit-task-title-input')
    expect(html).toContain('Review Q1 Reports')
  })

  it('renders the description textarea', async () => {
    const { html } = await renderApp('/project/p1/task/t1')
    expect(html).toContain('edit-task-desc-input')
  })

  it('renders the Edit Task heading', async () => {
    const { html } = await renderApp('/project/p1/task/t1')
    expect(html).toContain('Edit Task')
  })

  it('renders the delete button', async () => {
    const { html } = await renderApp('/project/p1/task/t1')
    expect(html).toContain('delete-task-btn')
  })
})

// ---------------------------------------------------------------------------
// Client-side: mount() renders the tree
// ---------------------------------------------------------------------------

describe('App — client-side DOM rendering (mount)', () => {
  let container: HTMLDivElement
  let dispose: Disposer

  beforeEach(() => {
    container = document.createElement('div')
    createRoot(() => {
      dispose = mount(jsx(App as unknown as Component, {}), container)
    })
  })

  afterEach(() => {
    dispose()
  })

  it('renders the app into the container', () => {
    expect(container.innerHTML).not.toBe('')
  })

  it('renders the dashboard by default (no initialUrl)', () => {
    // Without a URL it defaults to '/' and renders the dashboard
    expect(container.querySelector('[data-testid="dashboard"]')).not.toBeNull()
  })

  it('renders project cards', () => {
    expect(container.querySelector('[data-testid="project-card-p1"]')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Hydration: hydrate() reads window.__STEWIE_STATE__
// ---------------------------------------------------------------------------

describe('App — hydration from __STEWIE_STATE__', () => {
  let container: HTMLDivElement
  let dispose: Disposer

  const hydratedData: AppData = {
    projects: [
      { id: 'px', name: 'Hydrated Project', taskCount: 1 },
    ],
    tasks: [
      { id: 'tx', projectId: 'px', title: 'Hydrated Task', description: '', dueDate: null, isCompleted: false },
    ],
  }

  beforeEach(() => {
    window.__STEWIE_STATE__ = { appData: hydratedData }
    container = document.createElement('div')
    dispose = hydrate(jsx(App as unknown as Component, {}), container)
  })

  afterEach(() => {
    dispose()
    delete window.__STEWIE_STATE__
  })

  it('renders the hydrated project name', () => {
    expect(container.querySelector('[data-testid="project-card-px"]')).not.toBeNull()
  })

  it('renders Hydrated Project text', () => {
    expect(container.innerHTML).toContain('Hydrated Project')
  })

  it('dispose clears the container', () => {
    dispose()
    expect(container.innerHTML).toBe('')
    dispose = () => {}
  })
})
