// In-memory repository for the Work Queue example.
//
// This module owns all server-side app state. Route loaders and actions read
// from and write to it. On the server, this is a module-level singleton —
// shared across requests on a single server instance, which is correct for a
// demo (and realistic for a simple in-process server). In a real app, replace
// with a database client.
//
// Stable layer: the data shapes and access patterns here do not change when
// Stewie APIs change. Only the integration glue (loaders, actions, app.tsx)
// is version-sensitive.

import { seedProjects, seedTasks, seedUsers } from './seed.js';
import type { Project, Task, User, ProjectStatus, TaskPriority } from '../types.js';

// ---------------------------------------------------------------------------
// Internal storage — module-level, shared across requests
// ---------------------------------------------------------------------------

const projects: Project[] = seedProjects.map((p) => ({ ...p }));
const tasks: Task[] = seedTasks.map((t) => ({ ...t }));
const users: User[] = seedUsers.map((u) => ({ ...u }));

// ---------------------------------------------------------------------------
// User access (raw — no viewer-based restriction; the API client layer
// applies field-level restrictions on top of these).
// ---------------------------------------------------------------------------

export function getUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getUserByUsername(username: string): User | undefined {
  return users.find((u) => u.username === username);
}

export function getAllUsers(): User[] {
  return users.map((u) => ({ ...u }));
}

export function updateUser(id: string, updates: Partial<Pick<User, 'displayName' | 'email' | 'bio' | 'timezone' | 'avatarColor'>>): User {
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error(`User ${id} not found`);
  users[idx] = { ...users[idx], ...updates };
  return users[idx];
}

// ---------------------------------------------------------------------------
// Project access
// ---------------------------------------------------------------------------

export function getProjects(status: ProjectStatus = 'active'): Project[] {
  return projects.filter((p) => p.status === status);
}

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function createProject(data: { name: string; description: string; color: string }): Project {
  const project: Project = {
    id: `proj_${Date.now()}`,
    status: 'active',
    createdAt: new Date().toISOString(),
    ...data
  };
  projects.push(project);
  return project;
}

export function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'color' | 'status'>>): Project {
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Project ${id} not found`);
  projects[idx] = { ...projects[idx], ...updates };
  return projects[idx];
}

// ---------------------------------------------------------------------------
// Task access
// ---------------------------------------------------------------------------

export function getTasksForProject(projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

export function getTask(id: string): Task | undefined {
  return tasks.find((t) => t.id === id);
}

export function createTask(data: {
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
}): Task {
  const task: Task = {
    id: `task_${Date.now()}`,
    status: 'todo',
    ...data
  };
  tasks.push(task);
  return task;
}

export function updateTask(id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate' | 'assigneeId'>>): Task {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error(`Task ${id} not found`);
  tasks[idx] = { ...tasks[idx], ...updates };
  return tasks[idx];
}

export function deleteTask(id: string): void {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx !== -1) tasks.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// Aggregate stats (for dashboard)
// ---------------------------------------------------------------------------

export interface AppStats {
  totalProjects: number;
  totalTasks: number;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
}

export function getStats(): AppStats {
  const activeProjects = projects.filter((p) => p.status === 'active');
  return {
    totalProjects: activeProjects.length,
    totalTasks: tasks.length,
    todoCount: tasks.filter((t) => t.status === 'todo').length,
    inProgressCount: tasks.filter((t) => t.status === 'in_progress').length,
    doneCount: tasks.filter((t) => t.status === 'done').length
  };
}

// ---------------------------------------------------------------------------
// Task counts by project (for project cards)
// ---------------------------------------------------------------------------

export interface ProjectTaskCounts {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
}

export function getTaskCountsForProject(projectId: string): ProjectTaskCounts {
  const projectTasks = getTasksForProject(projectId);
  return {
    total: projectTasks.length,
    todo: projectTasks.filter((t) => t.status === 'todo').length,
    inProgress: projectTasks.filter((t) => t.status === 'in_progress').length,
    done: projectTasks.filter((t) => t.status === 'done').length
  };
}

// Reset to seed — useful for tests to restore known state
export function _resetToSeed(): void {
  projects.length = 0;
  tasks.length = 0;
  users.length = 0;
  projects.push(...seedProjects.map((p) => ({ ...p })));
  tasks.push(...seedTasks.map((t) => ({ ...t })));
  users.push(...seedUsers.map((u) => ({ ...u })));
}
