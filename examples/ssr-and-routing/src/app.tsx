/// <reference types="vite/client" />
// app.tsx — isomorphic App component for the ssr-and-routing example
//
// Runs on both server (SSR) and client (hydration).
// Server flow: renderApp(url) → renderToString(<App initialUrl={url} />) → HTML
// Client flow: hydrate(<App />, container) reads window.__STEWIE_STATE__

import { store, createContext, inject, signal, createRoot, computed } from '@stewie-js/core'
import { For, Show } from '@stewie-js/core'
import { useHydrationRegistry } from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'
import { Router, Route, useRouter } from '@stewie-js/router'
import { renderToString } from '@stewie-js/server'
import type { RenderResult } from '@stewie-js/server'
import './styles.css'

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

export interface Project {
  id: string
  name: string
  taskCount: number
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  dueDate: string | null
  isCompleted: boolean
}

export interface AppData {
  projects: Project[]
  tasks: Task[]
}

// ---------------------------------------------------------------------------
// App context — store + mutations provided to all views
// ---------------------------------------------------------------------------

export interface AppStore {
  projects: Project[]
  tasks: Task[]
  addProject(name: string): void
  addTask(projectId: string, title: string, description: string, dueDate: string | null): void
  updateTask(taskId: string, updates: Partial<Task>): void
  deleteTask(taskId: string): void
}

export const AppContext = createContext<AppStore | null>(null)

// ---------------------------------------------------------------------------
// Seed / default data
// ---------------------------------------------------------------------------

const defaultData: AppData = await import('./data.json').then(async (data) => {
  try {
    if (['true', true].some((condition) => condition === import.meta.env.VITE_USE_TEMP_MOCK)) {
      const mock = await import('./.temp-mocks/data.json'!);

      if (mock?.default) {
        return mock.default;
      }
    }
  }
  catch (error) {
    // it's ok, just default to the data we know we have
    console.error(error);
  }

  return data;
})

// ---------------------------------------------------------------------------
// Due date formatting helper
// ---------------------------------------------------------------------------

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'No date'
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  if (dueDate === tomorrowStr) return 'Due Tomorrow'
  return dueDate
}

// ---------------------------------------------------------------------------
// Dashboard view
// ---------------------------------------------------------------------------

function DashboardView(): JSXElement {
  const router = useRouter()
  const app = inject(AppContext)!

  return (
    <div class="container" data-testid="dashboard">
      <div class="page-header">
        <h1 class="page-title">Projects</h1>
      </div>
      <div class="grid" data-testid="project-grid">
        <For each={app.projects} key={(project) => project.id}>
          {(project: Project) => {
            const count = app.tasks.filter(
              (t) => t.projectId === project.id && !t.isCompleted
            ).length
            return (
              <div
                class="card"
                data-testid={`project-card-${project.id}`}
                onClick={() => router.navigate(`/project/${project.id}`)}
              >
                <p class="card-title">{project.name}</p>
                <p class="card-subtitle">{`${String(count)} active task${count !== 1 ? 's' : ''}`}</p>
              </div>
            )
          }}
        </For>
        <div
          class="card add-card"
          data-testid="new-project-card"
          onClick={() => router.navigate('/project/create')}
        >
          + New Project
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Project view
// ---------------------------------------------------------------------------

function CreateProjectView(): JSXElement {
  const router = useRouter()
  const app = inject(AppContext)!

  let nameSig!: ReturnType<typeof signal<string>>
  createRoot(() => {
    nameSig = signal('')
  })

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const name = nameSig()
    if (!name.trim()) return
    app.addProject(name.trim())
    router.navigate('/')
  }

  return (
    <div class="container" data-testid="create-project">
      <button class="back-btn" onClick={() => router.navigate('/')}>← Back</button>
      <div class="form-card">
        <h2 class="form-title">New Project</h2>
        <form onSubmit={handleSubmit} data-testid="create-project-form">
          <div class="input-group">
            <label for="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              placeholder="Enter project name"
              value={nameSig()}
              onInput={(e: Event) => { nameSig.set((e.target as HTMLInputElement).value) }}
              data-testid="project-name-input"
            />
          </div>
          <button type="submit" class="btn-primary" data-testid="create-project-submit">
            Create Project
          </button>
          <button type="button" class="btn-secondary" onClick={() => router.navigate('/')}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task edit sheet — rendered inside the side panel in ProjectDetailView
// ---------------------------------------------------------------------------

function TaskEditSheet({ task, onClose }: { task: Task; onClose: () => void }): JSXElement {
  const app = inject(AppContext)!

  let titleSig!: ReturnType<typeof signal<string>>
  let descSig!: ReturnType<typeof signal<string>>
  let dueDateSig!: ReturnType<typeof signal<string>>
  let completedSig!: ReturnType<typeof signal<boolean>>
  createRoot(() => {
    titleSig = signal(task.title)
    descSig = signal(task.description)
    dueDateSig = signal(task.dueDate ?? '')
    completedSig = signal(task.isCompleted)
  })

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    app.updateTask(task.id, {
      title: titleSig().trim(),
      description: descSig().trim(),
      dueDate: dueDateSig().trim() || null,
      isCompleted: completedSig(),
    })
    onClose()
  }

  const handleDelete = () => {
    app.deleteTask(task.id)
    onClose()
  }

  return (
    <div>
      <div class="task-sheet-header">
        <h2 class="task-sheet-title">Edit Task</h2>
        <button
          class="task-sheet-close"
          onClick={onClose}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>
      <form onSubmit={handleSubmit} data-testid="edit-task-form">
        <div class="input-group">
          <label for="edit-task-title">Title</label>
          <input
            id="edit-task-title"
            type="text"
            value={titleSig()}
            onInput={(e: Event) => { titleSig.set((e.target as HTMLInputElement).value) }}
            data-testid="edit-task-title-input"
          />
        </div>
        <div class="input-group">
          <label for="edit-task-desc">Description</label>
          <textarea
            id="edit-task-desc"
            value={descSig()}
            onInput={(e: Event) => { descSig.set((e.target as HTMLTextAreaElement).value) }}
            data-testid="edit-task-desc-input"
          />
        </div>
        <div class="input-group">
          <label for="edit-task-due">Due Date</label>
          <input
            id="edit-task-due"
            type="date"
            value={dueDateSig()}
            onInput={(e: Event) => { dueDateSig.set((e.target as HTMLInputElement).value) }}
            data-testid="edit-task-due-input"
          />
        </div>
        <div class="input-group" style="display: flex; align-items: center; gap: 0.5rem;">
          <input
            id="edit-task-completed"
            type="checkbox"
            checked={completedSig()}
            onChange={(e: Event) => { completedSig.set((e.target as HTMLInputElement).checked) }}
            data-testid="edit-task-completed-input"
            style="width: auto;"
          />
          <label for="edit-task-completed" style="margin: 0;">Completed</label>
        </div>
        <button type="submit" class="btn-primary" data-testid="edit-task-submit">
          Save Changes
        </button>
        <button
          type="button"
          class="btn-secondary"
          style="color: #ef4444; border-color: #fecaca; margin-top: 0.5rem;"
          onClick={handleDelete}
          data-testid="delete-task-btn"
        >
          Delete Task
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Project Detail view — handles both /project/:projectId
// and /project/:projectId/task/:taskId (two-column layout with task sheet)
// ---------------------------------------------------------------------------

function ProjectDetailView(): JSXElement {
  const router = useRouter()
  const app = inject(AppContext)!
  const { projectId, taskId: urlTaskId } = router.location.params

  const project = app.projects.find((p) => p.id === projectId)

  if (!project) {
    return (
      <div class="container" data-testid="project-not-found">
        <button class="back-btn" onClick={() => router.navigate('/')}>← Back</button>
        <p>Project not found.</p>
      </div>
    )
  }

  // Local signal for the selected task — avoids URL-driven remounting so the
  // component stays alive, reactive prop effects re-run, and the devtools
  // Renders tab can observe fine-grained updates.
  // Initialised from the URL param so direct-URL access and SSR still work.
  let selectedTaskId!: ReturnType<typeof signal<string | null>>
  createRoot(() => {
    selectedTaskId = signal(urlTaskId ?? null)
  })

  const closeSheet = () => selectedTaskId.set(null)

  const tasks = app.tasks.filter((t) => t.projectId === projectId)

  const listPane = (
    <div data-testid={`project-detail-${projectId}`}>
      <button class="back-btn" onClick={() => router.navigate('/')}>← Back</button>
      <div class="page-header">
        <h1 class="page-title" data-testid="project-name">{project.name}</h1>
        <button
          class="btn-primary"
          style="width: auto; padding: 0.5rem 1rem;"
          onClick={() => router.navigate(`/project/${projectId}/task/create`)}
          data-testid="add-task-btn"
        >
          + Add Task
        </button>
      </div>
      <Show
        when={tasks.length > 0}
        fallback={
          <div class="empty-state" data-testid="no-tasks">No tasks yet. Add one!</div>
        }
      >
        <div data-testid="task-list">
          <For each={tasks} key={(task) => task.id}>
            {(task: Task) => {
              const isSelected = computed(() => task.id === selectedTaskId());
              const cssClasses = computed(() => {
                return [
                  'task-row',
                  isSelected() && 'task-row-selected',
                  task.isCompleted && 'task-row-completed'
                ].filter(Boolean).join(' ');
              });

              return (
                <div
                  class={cssClasses}
                  data-testid={`task-row-${task.id}`}
                  onClick={() => selectedTaskId.set(task.id)}
                >
                  <span class="task-title">{task.title}</span>
                  <span class="badge" data-testid={`task-badge-${task.id}`}>
                    {formatDueDate(task.dueDate)}
                  </span>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  )

  // Outer div class switches between single-column (.container) and two-column
  // (.project-layout) reactively — no remount, just a class change.
  // The list pane is always in the DOM; only the sheet Show mounts/unmounts.
  return (
    <div class={() => selectedTaskId() !== null ? 'project-layout' : 'container'}>
      <div class="task-list-pane">
        {listPane}
      </div>
      <Show when={() => selectedTaskId() !== null}>
        {() => {
          const task = app.tasks.find((t) => t.id === selectedTaskId())
          if (!task) return <p data-testid="task-not-found">Task not found.</p>
          return (
            <div class="task-sheet" data-testid="edit-task">
              <TaskEditSheet task={task} onClose={closeSheet} />
            </div>
          )
        }}
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create Task view
// ---------------------------------------------------------------------------

function CreateTaskView(): JSXElement {
  const router = useRouter()
  const app = inject(AppContext)!
  const projectId = router.location.params.projectId

  let titleSig!: ReturnType<typeof signal<string>>
  let descSig!: ReturnType<typeof signal<string>>
  let dueDateSig!: ReturnType<typeof signal<string>>
  createRoot(() => {
    titleSig = signal('')
    descSig = signal('')
    dueDateSig = signal('')
  })

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    const title = titleSig()
    if (!title.trim()) return
    const dueDate = dueDateSig().trim() || null
    app.addTask(projectId, title.trim(), descSig().trim(), dueDate)
    router.navigate(`/project/${projectId}`)
  }

  return (
    <div class="container" data-testid="create-task">
      <button class="back-btn" onClick={() => router.navigate(`/project/${projectId}`)}>
        ← Back
      </button>
      <div class="form-card">
        <h2 class="form-title">New Task</h2>
        <form onSubmit={handleSubmit} data-testid="create-task-form">
          <div class="input-group">
            <label for="task-title">Title</label>
            <input
              id="task-title"
              type="text"
              placeholder="Task title"
              value={titleSig()}
              onInput={(e: Event) => { titleSig.set((e.target as HTMLInputElement).value) }}
              data-testid="task-title-input"
            />
          </div>
          <div class="input-group">
            <label for="task-desc">Description</label>
            <textarea
              id="task-desc"
              placeholder="Optional description"
              value={descSig()}
              onInput={(e: Event) => { descSig.set((e.target as HTMLTextAreaElement).value) }}
              data-testid="task-desc-input"
            />
          </div>
          <div class="input-group">
            <label for="task-due">Due Date</label>
            <input
              id="task-due"
              type="date"
              value={dueDateSig()}
              onInput={(e: Event) => { dueDateSig.set((e.target as HTMLInputElement).value) }}
              data-testid="task-due-input"
            />
          </div>
          <button type="submit" class="btn-primary" data-testid="create-task-submit">
            Add Task
          </button>
          <button
            type="button"
            class="btn-secondary"
            onClick={() => router.navigate(`/project/${projectId}`)}
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App — root component
// ---------------------------------------------------------------------------

export function App({ initialUrl }: { initialUrl?: string } = {}): JSXElement {
  const registry = useHydrationRegistry()

  const serverData =
    (registry?.get('appData') as AppData | undefined) ?? defaultData

  registry?.set('appData', serverData)

  const appStore = store({ projects: [...serverData.projects], tasks: [...serverData.tasks] })

  const context: AppStore = {
    get projects() { return appStore.projects },
    set projects(v) { appStore.projects = v },
    get tasks() { return appStore.tasks },
    set tasks(v) { appStore.tasks = v },

    addProject(name: string) {
      const id = `p${Date.now()}`
      const newProject: Project = { id, name, taskCount: 0 }
      appStore.projects = [...appStore.projects, newProject]
    },

    addTask(projectId: string, title: string, description: string, dueDate: string | null) {
      const id = `t${Date.now()}`
      const newTask: Task = { id, projectId, title, description, dueDate, isCompleted: false }
      appStore.tasks = [...appStore.tasks, newTask]
    },

    updateTask(taskId: string, updates: Partial<Task>) {
      appStore.tasks = appStore.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      )
    },

    deleteTask(taskId: string) {
      appStore.tasks = appStore.tasks.filter((t) => t.id !== taskId)
    },
  }

  return (
    <AppContext.Provider value={context}>
      <Router initialUrl={initialUrl}>
        <Route path="/" component={DashboardView} />
        <Route path="/project/create" component={CreateProjectView} />
        <Route path="/project/:projectId" component={ProjectDetailView} />
        <Route path="/project/:projectId/task/create" component={CreateTaskView} />
        <Route path="/project/:projectId/task/:taskId" component={ProjectDetailView} />
      </Router>
    </AppContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// renderApp — server-side entry point used by server.ts and tests
// ---------------------------------------------------------------------------

export async function renderApp(url: string = '/'): Promise<RenderResult> {
  return renderToString(<App initialUrl={url} />)
}
