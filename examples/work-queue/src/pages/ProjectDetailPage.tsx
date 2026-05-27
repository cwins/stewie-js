/// <reference types="vite/client" />
// Project detail page — route: /projects/:projectId
//
// Teaching points:
//   - Route loader data via useRouteData<ProjectDetailData>()
//   - signal() for local UI state (selected task, edit sheet open)
//   - computed() for derived task lists (by status)
//   - Show for conditional rendering (edit sheet)
//   - Inline status toggle as an optimistic local mutation (no navigate-to-refresh)
//   - navigate-to-refresh after create/delete (loader re-runs on navigation)
//
// Mutation patterns demonstrated:
//   - "navigate-to-refresh": create task → navigate to same route → loader re-fires
//   - "optimistic local update": status toggle → update local task signal → no navigation
//   - "navigate-to-refresh" after delete: delete task → navigate away → loader on return is fresh

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, For, Show, useAction } from '@stewie-js/core';
import { useRouteData, useParams, Link } from '@stewie-js/router';
import { TaskRow } from '../components/TaskRow.js';
import { EmptyState } from '../components/lib/EmptyState.js';
import { createTaskAction, updateTaskAction, deleteTaskAction } from '../actions/tasks.js';
import type { ProjectDetailData } from '../loaders/project-detail.js';
import type { Task, TaskStatus, UserPublic } from '../data/types.js';
import { ProjectDetailRoute } from '../routes.js';

// ---------------------------------------------------------------------------
// Task edit sheet
// ---------------------------------------------------------------------------

interface TaskEditSheetProps {
  task: Task;
  users: UserPublic[];
  onClose: () => void;
  onDeleted: (taskId: string) => void;
  onUpdated: (task: Task) => void;
}

function TaskEditSheet({ task, users, onClose, onDeleted, onUpdated }: TaskEditSheetProps): JSXElement {
  // Local form state — signal() for each field
  const $title = signal(task.title);
  const $description = signal(task.description);
  const $status = signal<TaskStatus>(task.status);
  const $priority = signal(task.priority);
  const $dueDate = signal(task.dueDate ?? '');
  const $assigneeId = signal<string | null>(task.assigneeId);

  const save = useAction(updateTaskAction);
  const remove = useAction(deleteTaskAction);

  const $displayError = computed(() => save.error()?.message ?? remove.error()?.message ?? '');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!$title().trim()) return;

    const result = await save.run({
      id: task.id,
      title: $title.peek(),
      description: $description.peek(),
      status: $status.peek(),
      priority: $priority.peek(),
      dueDate: $dueDate.peek() || null,
      assigneeId: $assigneeId.peek()
    });
    if (result === undefined) return;

    onUpdated(result);
    onClose();
  };

  const handleDelete = async () => {
    await remove.run(task.id);
    if (remove.lastRun() !== 'success') return;
    onDeleted(task.id);
    onClose();
  };

  return (
    <div class="task-sheet" data-testid="task-sheet">
      <div class="task-sheet-header">
        <h2 class="task-sheet-title">Edit Task</h2>
        <div class="task-sheet-header-actions">
          <Link to={`/tasks/${task.id}`} class="btn btn-ghost btn-sm" data-testid="view-task-detail-btn">
            Full detail →
          </Link>
          <button class="task-sheet-close" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} data-testid="edit-task-form">
        <Show when={() => $displayError() !== ''}>
          {() => (
            <p class="form-error" role="alert">
              {() => $displayError()}
            </p>
          )}
        </Show>

        <div class="field-group">
          <label class="field-label" for="edit-title">
            Title
          </label>
          <input
            id="edit-title"
            class="field-input"
            type="text"
            value={$title()}
            onInput={(e: InputEvent) => $title.set((e.target as HTMLInputElement).value)}
            data-testid="edit-task-title"
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="edit-desc">
            Description
          </label>
          <textarea
            id="edit-desc"
            class="field-input field-textarea"
            value={$description()}
            onInput={(e: InputEvent) => $description.set((e.target as HTMLTextAreaElement).value)}
            data-testid="edit-task-desc"
          />
        </div>

        <div class="field-row">
          <div class="field-group">
            <label class="field-label" for="edit-status">
              Status
            </label>
            <select
              id="edit-status"
              class="field-select"
              value={$status()}
              onChange={(e: Event) => $status.set((e.target as HTMLSelectElement).value as TaskStatus)}
              data-testid="edit-task-status"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label" for="edit-priority">
              Priority
            </label>
            <select
              id="edit-priority"
              class="field-select"
              value={$priority()}
              onChange={(e: Event) => $priority.set((e.target as HTMLSelectElement).value as Task['priority'])}
              data-testid="edit-task-priority"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="edit-due">
            Due Date
          </label>
          <input
            id="edit-due"
            class="field-input"
            type="date"
            value={$dueDate()}
            onInput={(e: InputEvent) => $dueDate.set((e.target as HTMLInputElement).value)}
            data-testid="edit-task-due"
          />
        </div>

        <div class="field-group">
          <label class="field-label" for="edit-assignee">
            Assignee
          </label>
          <select
            id="edit-assignee"
            class="field-select"
            value={$assigneeId() ?? ''}
            onChange={(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              $assigneeId.set(v === '' ? null : v);
            }}
            data-testid="edit-task-assignee"
          >
            <option value="">Unassigned</option>
            {() => users.map((u) => <option value={u.id}>{u.displayName}</option>)}
          </select>
        </div>

        <div class="task-sheet-actions">
          <button type="submit" class="btn btn-primary" disabled={() => save.pending()} data-testid="edit-task-save">
            {() => (save.pending() ? 'Saving\u2026' : 'Save Changes')}
          </button>
          <button
            type="button"
            class="btn btn-destructive"
            onClick={handleDelete}
            disabled={() => remove.pending()}
            data-testid="delete-task-btn"
          >
            Delete Task
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create task form (inline, shown below the task list)
// ---------------------------------------------------------------------------

interface CreateTaskFormProps {
  projectId: string;
  users: UserPublic[];
  onCreated: (task: Task) => void;
  onCancel: () => void;
}

function CreateTaskForm({ projectId, users, onCreated, onCancel }: CreateTaskFormProps): JSXElement {
  const $title = signal('');
  const $description = signal('');
  const $priority = signal<Task['priority']>('medium');
  const $dueDate = signal('');
  const $assigneeId = signal<string | null>(null);

  const create = useAction(createTaskAction);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!$title().trim()) return;

    const result = await create.run({
      projectId,
      title: $title.peek(),
      description: $description.peek(),
      priority: $priority.peek(),
      dueDate: $dueDate.peek() || null,
      assigneeId: $assigneeId.peek()
    });
    if (result === undefined) return;

    onCreated(result);
  };

  return (
    <form class="create-task-form" onSubmit={handleSubmit} data-testid="create-task-form">
      <Show when={() => create.error() !== null}>
        {() => (
          <p class="form-error" role="alert">
            {() => create.error()?.message ?? ''}
          </p>
        )}
      </Show>
      <div class="field-group">
        <input
          class="field-input"
          type="text"
          placeholder="Task title"
          value={$title()}
          onInput={(e: InputEvent) => $title.set((e.target as HTMLInputElement).value)}
          data-testid="create-task-title"
          autoFocus
        />
      </div>
      <div class="create-task-row">
        <select
          class="field-select"
          value={$priority()}
          onChange={(e: Event) => $priority.set((e.target as HTMLSelectElement).value as Task['priority'])}
          data-testid="create-task-priority"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input
          class="field-input"
          type="date"
          value={$dueDate()}
          onInput={(e: InputEvent) => $dueDate.set((e.target as HTMLInputElement).value)}
          data-testid="create-task-due"
        />
        <select
          class="field-select"
          value={$assigneeId() ?? ''}
          onChange={(e: Event) => {
            const v = (e.target as HTMLSelectElement).value;
            $assigneeId.set(v === '' ? null : v);
          }}
          data-testid="create-task-assignee"
        >
          <option value="">Unassigned</option>
          {() => users.map((u) => <option value={u.id}>{u.displayName}</option>)}
        </select>
        <button type="submit" class="btn btn-primary btn-sm" disabled={() => create.pending()} data-testid="create-task-submit">
          {() => (create.pending() ? 'Adding\u2026' : 'Add')}
        </button>
        <button type="button" class="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ProjectDetailPage
// ---------------------------------------------------------------------------

export function ProjectDetailPage(): JSXElement {
  const { projectId } = useParams(ProjectDetailRoute);
  const data = useRouteData<ProjectDetailData>();

  // Local mutable copies of loader data.
  // The loader provides the authoritative initial state; signals make it reactive
  // so inline edits and deletions update the UI without a full navigation.
  const $tasks = signal<Task[]>(data.tasks);
  const $selectedTask = signal<Task | null>(null);
  const $showCreateForm = signal(false);

  // Stable lookup for the row + chip — built once from loader data. If the
  // viewer's visibility changes, the loader re-runs and this map rebuilds.
  const usersById: Record<string, UserPublic> = Object.fromEntries(data.users.map((u) => [u.id, u]));
  const getUsersById = () => usersById;

  // Derived task groups
  const todoTasks = computed(() => $tasks().filter((t) => t.status === 'todo'));
  const inProgressTasks = computed(() => $tasks().filter((t) => t.status === 'in_progress'));
  const doneTasks = computed(() => $tasks().filter((t) => t.status === 'done'));
  const hasTasks = computed(() => $tasks().length > 0);

  const closeSheet = () => $selectedTask.set(null);

  // Optimistic delete — remove from local signal, no navigation needed
  const handleDeleted = (taskId: string) => {
    $tasks.set($tasks().filter((t) => t.id !== taskId));
  };

  // Optimistic update — replace the task in the local signal with the updated version
  const handleUpdated = (updated: Task) => {
    $tasks.set($tasks().map((t) => (t.id === updated.id ? updated : t)));
  };

  // Optimistic create — add to local signal, no navigation needed
  const handleCreated = (task: Task) => {
    $tasks.set([...$tasks(), task]);
    $showCreateForm.set(false);
  };

  const panelOpen = computed(() => $selectedTask() !== null);

  return (
    <main
      class={() => `page project-detail-layout${panelOpen() ? ' project-detail-layout-split' : ''}`}
      data-testid={`project-detail-${projectId}`}
    >
      {/* Task list pane */}
      <div class="project-pane">
        <div class="page-header">
          <div class="page-header-start">
            <Link to="/projects" class="back-link" data-testid="back-link">
              ← Projects
            </Link>
            <h1 class="page-title" data-testid="project-name">
              {data.project.name}
            </h1>
            <Link to={`/projects/${projectId}/edit`} class="btn btn-ghost btn-sm" data-testid="edit-project-btn">
              Edit
            </Link>
          </div>
          <button
            class="btn btn-primary"
            onClick={() => {
              $selectedTask.set(null);
              $showCreateForm.set(true);
            }}
            data-testid="add-task-btn"
          >
            + Add Task
          </button>
        </div>

        {data.project.description ? <p class="project-description">{data.project.description}</p> : null}

        <Show when={() => $showCreateForm()}>
          {() => (
            <CreateTaskForm
              projectId={projectId}
              users={data.users}
              onCreated={handleCreated}
              onCancel={() => $showCreateForm.set(false)}
            />
          )}
        </Show>

        <Show
          when={hasTasks}
          fallback={<EmptyState title="No tasks yet" description="Add your first task to get started." testId="tasks-empty" />}
        >
          {() => (
            <div class="task-sections">
              <Show when={() => inProgressTasks().length > 0}>
                {() => (
                  <section aria-labelledby="in-progress-heading">
                    <h2 class="task-section-title" id="in-progress-heading">
                      In Progress
                    </h2>
                    <div data-testid="tasks-in-progress">
                      <For each={inProgressTasks} by={(t) => t.id}>
                        {(getTask) => (
                          <TaskRow
                            task={getTask}
                            usersById={getUsersById}
                            isSelected={() => $selectedTask()?.id === getTask().id}
                            onSelect={(task) => {
                              $showCreateForm.set(false);
                              $selectedTask.set(task);
                            }}
                          />
                        )}
                      </For>
                    </div>
                  </section>
                )}
              </Show>

              <Show when={() => todoTasks().length > 0}>
                {() => (
                  <section aria-labelledby="todo-heading">
                    <h2 class="task-section-title" id="todo-heading">
                      To Do
                    </h2>
                    <div data-testid="tasks-todo">
                      <For each={todoTasks} by={(t) => t.id}>
                        {(getTask) => (
                          <TaskRow
                            task={getTask}
                            usersById={getUsersById}
                            isSelected={() => $selectedTask()?.id === getTask().id}
                            onSelect={(task) => {
                              $showCreateForm.set(false);
                              $selectedTask.set(task);
                            }}
                          />
                        )}
                      </For>
                    </div>
                  </section>
                )}
              </Show>

              <Show when={() => doneTasks().length > 0}>
                {() => (
                  <section aria-labelledby="done-heading">
                    <h2 class="task-section-title" id="done-heading">
                      Done
                    </h2>
                    <div data-testid="tasks-done">
                      <For each={doneTasks} by={(t) => t.id}>
                        {(getTask) => (
                          <TaskRow
                            task={getTask}
                            usersById={getUsersById}
                            isSelected={() => $selectedTask()?.id === getTask().id}
                            onSelect={(task) => {
                              $showCreateForm.set(false);
                              $selectedTask.set(task);
                            }}
                          />
                        )}
                      </For>
                    </div>
                  </section>
                )}
              </Show>
            </div>
          )}
        </Show>
      </div>

      {/* Task edit sheet — side panel */}
      <Show when={() => $selectedTask() !== null}>
        {() => {
          const task = $selectedTask();
          if (!task) return null;
          return (
            <TaskEditSheet
              task={task}
              users={data.users}
              onClose={closeSheet}
              onDeleted={handleDeleted}
              onUpdated={handleUpdated}
            />
          );
        }}
      </Show>
    </main>
  );
}
