// Domain types for the Work Queue app.
//
// These are the stable, framework-independent definitions.
// Nothing in this file imports from @stewie-js/*; it is safe to import
// from loaders, actions, pages, and tests without pulling in reactivity.

export type ProjectStatus = 'active' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  /** Hex color string used for visual accent on project cards. */
  color: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO date string (YYYY-MM-DD) or null. */
  dueDate: string | null;
}
