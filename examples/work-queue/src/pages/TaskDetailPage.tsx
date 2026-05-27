/// <reference types="vite/client" />
// Task detail page — route: /tasks/:taskId
//
// A dedicated full-page view for a single task. Complements the inline
// edit sheet in ProjectDetailPage (quick edits stay in the sheet; the
// detail page is for deep-linking and a fuller editing experience).
//
// Teaching points:
//   - Route loader with a secondary entity (task + parent project in one loader)
//   - signal() seeded from loader data (edit form pattern)
//   - computed() for validation and derived display (e.g. has changes)
//   - Navigate-to-refresh after save: navigate back to project detail
//   - Destructive action (delete) with two-step confirm

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, Show, useAction } from '@stewie-js/core';
import { useRouteData, useParams, useRouter, Link } from '@stewie-js/router';
import { StatusBadge, PriorityBadge } from '../components/lib/Badge.js';
import { updateTaskAction, deleteTaskAction } from '../actions/tasks.js';
import type { TaskDetailData } from '../loaders/task-detail.js';
import type { TaskStatus } from '../data/types.js';
import { TaskDetailRoute } from '../routes.js';

export function TaskDetailPage(): JSXElement {
  const { taskId } = useParams(TaskDetailRoute);
  const { task, project, users } = useRouteData<TaskDetailData>();
  const router = useRouter();

  // Form signals seeded from loader data
  const $title = signal(task.title);
  const $description = signal(task.description);
  const $status = signal<TaskStatus>(task.status);
  const $priority = signal(task.priority);
  const $dueDate = signal(task.dueDate ?? '');
  const $assigneeId = signal<string | null>(task.assigneeId);
  const $confirmDelete = signal(false);

  const save = useAction(updateTaskAction);
  const remove = useAction(deleteTaskAction);

  const isValid = computed(() => $title().trim().length > 0);

  // Derived: detect unsaved changes so the save button is only active when needed.
  const hasChanges = computed(
    () =>
      $title() !== task.title ||
      $description() !== task.description ||
      $status() !== task.status ||
      $priority() !== task.priority ||
      ($dueDate() || null) !== task.dueDate ||
      $assigneeId() !== task.assigneeId
  );

  // Unified error: whichever action last errored surfaces here.
  const $displayError = computed(() => save.error()?.message ?? remove.error()?.message ?? '');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isValid()) return;

    const result = await save.run({
      id: taskId,
      title: $title.peek(),
      description: $description.peek(),
      status: $status.peek(),
      priority: $priority.peek(),
      dueDate: $dueDate.peek() || null,
      assigneeId: $assigneeId.peek()
    });
    if (result === undefined) return;

    // Navigate-to-refresh back to the project detail page.
    await router.navigate(`/projects/${project.id}`);
  };

  const handleDelete = async () => {
    await remove.run(taskId);
    if (remove.lastRun() !== 'success') return;
    await router.navigate(`/projects/${project.id}`);
  };

  return (
    <main class="page" data-testid={`task-detail-${taskId}`}>
      <div class="page-header">
        <Link to={`/projects/${project.id}`} class="back-link" data-testid="back-link">
          {`← ${project.name}`}
        </Link>
        <h1 class="page-title" data-testid="task-title-heading">
          {task.title}
        </h1>
        <div class="page-header-badges">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
      </div>

      <div class="form-card">
        <form onSubmit={handleSubmit} data-testid="edit-task-form">
          <Show when={() => $displayError() !== ''}>
            {() => (
              <p class="form-error" role="alert">
                {() => $displayError()}
              </p>
            )}
          </Show>

          <div class="field-group">
            <label class="field-label" for="task-title">
              Title <span aria-hidden="true">*</span>
            </label>
            <input
              id="task-title"
              class="field-input"
              type="text"
              value={$title()}
              onInput={(e: InputEvent) => $title.set((e.target as HTMLInputElement).value)}
              data-testid="task-title-input"
              required
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="task-description">
              Description
            </label>
            <textarea
              id="task-description"
              class="field-input field-textarea"
              value={$description()}
              onInput={(e: InputEvent) => $description.set((e.target as HTMLTextAreaElement).value)}
              data-testid="task-description-input"
            />
          </div>

          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="task-status">
                Status
              </label>
              <select
                id="task-status"
                class="field-select"
                value={$status()}
                onChange={(e: Event) => $status.set((e.target as HTMLSelectElement).value as TaskStatus)}
                data-testid="task-status-select"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div class="field-group">
              <label class="field-label" for="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                class="field-select"
                value={$priority()}
                onChange={(e: Event) => $priority.set((e.target as HTMLSelectElement).value as typeof task.priority)}
                data-testid="task-priority-select"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div class="field-group">
              <label class="field-label" for="task-due">
                Due Date
              </label>
              <input
                id="task-due"
                class="field-input"
                type="date"
                value={$dueDate()}
                onInput={(e: InputEvent) => $dueDate.set((e.target as HTMLInputElement).value)}
                data-testid="task-due-input"
              />
            </div>
          </div>

          <div class="field-group">
            <label class="field-label" for="task-assignee">
              Assignee
            </label>
            <select
              id="task-assignee"
              class="field-select"
              value={$assigneeId() ?? ''}
              onChange={(e: Event) => {
                const v = (e.target as HTMLSelectElement).value;
                $assigneeId.set(v === '' ? null : v);
              }}
              data-testid="task-assignee-select"
            >
              <option value="">Unassigned</option>
              {() => users.map((u) => <option value={u.id}>{u.displayName}</option>)}
            </select>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={() => !isValid() || !hasChanges() || save.pending()}
              data-testid="save-task-btn"
            >
              {() => (save.pending() ? 'Saving\u2026' : 'Save Changes')}
            </button>
            <Link to={`/projects/${project.id}`} class="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <div class="danger-zone" data-testid="danger-zone">
        <h2 class="danger-zone-title">Danger Zone</h2>
        <div class="danger-zone-row">
          <div>
            <p class="danger-zone-label">Delete this task</p>
            <p class="danger-zone-desc">This action cannot be undone.</p>
          </div>
          <Show
            when={$confirmDelete}
            fallback={
              <button
                type="button"
                class="btn btn-destructive-outline"
                onClick={() => $confirmDelete.set(true)}
                data-testid="delete-task-btn"
              >
                Delete
              </button>
            }
          >
            {() => (
              <div class="confirm-row">
                <span class="confirm-label">Are you sure?</span>
                <button type="button" class="btn btn-destructive" onClick={handleDelete} data-testid="confirm-delete-btn">
                  Yes, delete
                </button>
                <button type="button" class="btn btn-ghost" onClick={() => $confirmDelete.set(false)} data-testid="cancel-delete-btn">
                  Cancel
                </button>
              </div>
            )}
          </Show>
        </div>
      </div>
    </main>
  );
}
