// app.tsx — isomorphic App component for the ssr-and-routing example
//
// Runs on both server (SSR) and client (hydration).
// Server flow: renderApp(url) → renderToString(<App initialUrl={url} />) → HTML
// Client flow: hydrate(<App />, container) reads window.__STEWIE_STATE__

import { store, createContext, inject, signal, createRoot } from '@stewie/core'
import { For, Show } from '@stewie/core'
import { useHydrationRegistry } from '@stewie/core'
import type { JSXElement } from '@stewie/core'
import { Router, Route, useRouter } from '@stewie/router'
import { renderToString } from '@stewie/server'
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

const defaultData: AppData = {
  projects: [
    { id: 'p1', name: 'Work Tasks', taskCount: 2 },
    { id: 'p2', name: 'Personal Goals', taskCount: 1 },
  ],
  tasks: [
    { id: 't1', projectId: 'p1', title: 'Review Q1 Reports', description: 'Check the numbers', dueDate: '2026-03-25', isCompleted: false },
    { id: 't2', projectId: 'p1', title: 'Email Marketing Team', description: '', dueDate: null, isCompleted: false },
    { id: 't3', projectId: 'p2', title: 'Run 5K', description: 'Morning run', dueDate: '2026-03-30', isCompleted: false },
  ],
}

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
        <For each={app.projects}>
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
                <p class="card-subtitle">{count} active task{count !== 1 ? 's' : ''}</p>
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
// Project Detail view
// ---------------------------------------------------------------------------

function ProjectDetailView(): JSXElement {
  const router = useRouter()
  const app = inject(AppContext)!
  const projectId = router.location.params.projectId

  const project = app.projects.find((p) => p.id === projectId)

  if (!project) {
    return (
      <div class="container" data-testid="project-not-found">
        <button class="back-btn" onClick={() => router.navigate('/')}>← Back</button>
        <p>Project not found.</p>
      </div>
    )
  }

  const tasks = app.tasks.filter((t) => t.projectId === projectId)

  return (
    <div class="container" data-testid={`project-detail-${projectId}`}>
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
          <div class="empty-state" data-testid="no-tasks">
            No tasks yet. Add one!
          </div>
        }
      >
        <div data-testid="task-list">
          <For each={tasks}>
            {(task: Task) => (
              <div
                class={`task-row${task.isCompleted ? ' task-row-completed' : ''}`}
                data-testid={`task-row-${task.id}`}
                onClick={() => router.navigate(`/project/${projectId}/task/${task.id}`)}
              >
                <span class="task-title">{task.title}</span>
                <span class="badge" data-testid={`task-badge-${task.id}`}>
                  {formatDueDate(task.dueDate)}
                </span>
              </div>
            )}
          </For>
        </div>
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
// Edit Task view
// ---------------------------------------------------------------------------

function EditTaskView(): JSXElement {
  const router = useRouter()
  const app = inject(AppContext)!
  const { projectId, taskId } = router.location.params

  const task = app.tasks.find((t) => t.id === taskId)

  if (!task) {
    return (
      <div class="container" data-testid="task-not-found">
        <button class="back-btn" onClick={() => router.navigate(`/project/${projectId}`)}>
          ← Back
        </button>
        <p>Task not found.</p>
      </div>
    )
  }

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
    const dueDate = dueDateSig().trim() || null
    app.updateTask(taskId, {
      title: titleSig().trim(),
      description: descSig().trim(),
      dueDate,
      isCompleted: completedSig(),
    })
    router.navigate(`/project/${projectId}`)
  }

  const handleDelete = () => {
    app.deleteTask(taskId)
    router.navigate(`/project/${projectId}`)
  }

  return (
    <div class="container" data-testid="edit-task">
      <button class="back-btn" onClick={() => router.navigate(`/project/${projectId}`)}>
        ← Back
      </button>
      <div class="form-card">
        <h2 class="form-title">Edit Task</h2>
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
        <Route path="/project/:projectId/task/:taskId" component={EditTaskView} />
      </Router>
    </AppContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// renderApp — server-side entry point used by server.ts and tests
// ---------------------------------------------------------------------------

export async function renderApp(url: string = '/'): Promise<string> {
  return renderToString(<App initialUrl={url} />)
}
