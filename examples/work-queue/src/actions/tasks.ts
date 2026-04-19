// Task mutations.
//
// Each action validates its input, delegates to the repo, and returns the
// updated entity. The caller decides what happens next — typically navigate()
// to re-run the route loader and render fresh data (navigate-to-refresh).
//
// For inline status toggles, the caller may choose to update local reactive
// state optimistically without navigating, since the server state and client
// state are in sync for the current render.

import { createTask as repoCreateTask, updateTask as repoUpdateTask, deleteTask as repoDeleteTask } from '../data/mocks/repo.js';
import type { Task, TaskStatus, TaskPriority } from '../data/types.js';

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
}

export function createTask(input: CreateTaskInput): Task {
  if (!input.title.trim()) throw new Error('Task title is required');
  return repoCreateTask({
    projectId: input.projectId,
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    dueDate: input.dueDate || null
  });
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export function updateTask(id: string, input: UpdateTaskInput): Task {
  const updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate'>> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description.trim();
  if (input.status !== undefined) updates.status = input.status;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate || null;
  return repoUpdateTask(id, updates);
}

export function deleteTask(id: string): void {
  repoDeleteTask(id);
}
