// Task mutations.
//
// defineAction at module scope — no signals created, safe to share across files.
// useAction(def) inside the component creates the per-component pending/error instance.
//
// Post-mutation work (navigate, local state sync) stays in the caller.

import { defineAction } from '@stewie-js/core';
import { createTask as repoCreateTask, updateTask as repoUpdateTask, deleteTask as repoDeleteTask } from '../data/mocks/repo.js';
import type { Task, TaskStatus, TaskPriority } from '../data/types.js';

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
}

export const createTaskAction = defineAction((input: CreateTaskInput): Task => {
  if (!input.title.trim()) throw new Error('Task title is required');
  return repoCreateTask({
    projectId: input.projectId,
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    dueDate: input.dueDate || null,
    assigneeId: input.assigneeId
  });
});

export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeId?: string | null;
}

export const updateTaskAction = defineAction((input: UpdateTaskInput): Task => {
  const updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate' | 'assigneeId'>> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description.trim();
  if (input.status !== undefined) updates.status = input.status;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate || null;
  if (input.assigneeId !== undefined) updates.assigneeId = input.assigneeId;
  return repoUpdateTask(input.id, updates);
});

export const deleteTaskAction = defineAction((id: string): void => {
  repoDeleteTask(id);
});
