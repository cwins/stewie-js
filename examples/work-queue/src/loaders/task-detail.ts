// Loader for the task detail route: /tasks/:taskId
//
// Loads the task and its parent project together so the page can display
// both without separate fetches.
//
// Stable layer — no Stewie imports.

import { getTask, getProject } from '../data/mocks/repo.js';
import type { Task, Project } from '../data/types.js';

export interface TaskDetailData {
  task: Task;
  project: Project;
}

export async function taskDetailLoader(params: Record<string, string>): Promise<TaskDetailData> {
  const task = getTask(params.taskId);
  if (!task) throw new Error(`Task "${params.taskId}" not found`);
  const project = getProject(task.projectId);
  if (!project) throw new Error(`Project for task "${params.taskId}" not found`);
  return { task, project };
}
