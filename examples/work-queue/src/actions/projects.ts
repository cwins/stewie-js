// Project mutations.
//
// Actions are plain async functions that write to the repo. They are called
// from page components after user interaction. After a successful write,
// the caller navigates to the appropriate route — the route loader then
// re-runs and the page re-renders with fresh data.
//
// This is the canonical "navigate-to-refresh" mutation pattern: no cache
// invalidation needed because navigation re-executes the loader.

import { createProject as repoCreateProject, updateProject as repoUpdateProject } from '../data/repo.js';
import type { Project } from '../data/types.js';

export interface CreateProjectInput {
  name: string;
  description: string;
  color: string;
}

export function createProject(input: CreateProjectInput): Project {
  if (!input.name.trim()) throw new Error('Project name is required');
  return repoCreateProject({
    name: input.name.trim(),
    description: input.description.trim(),
    color: input.color
  });
}

export function archiveProject(id: string): Project {
  return repoUpdateProject(id, { status: 'archived' });
}
