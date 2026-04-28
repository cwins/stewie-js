// Project mutations.
//
// defineAction at module scope — no signals created, safe to share across files.
// useAction(def) inside the component creates the per-component pending/error instance.
//
// Post-mutation work (navigate, toast) stays in the caller after awaiting run().

import { defineAction } from '@stewie-js/core';
import { createProject as repoCreateProject, updateProject as repoUpdateProject } from '../data/mocks/repo.js';
import type { Project } from '../data/types.js';

export interface CreateProjectInput {
  name: string;
  description: string;
  color: string;
}

export const createProjectAction = defineAction((input: CreateProjectInput): Project => {
  if (!input.name.trim()) throw new Error('Project name is required');
  return repoCreateProject({
    name: input.name.trim(),
    description: input.description.trim(),
    color: input.color
  });
});

export interface UpdateProjectInput {
  id: string;
  name: string;
  description: string;
  color: string;
}

export const updateProjectAction = defineAction((input: UpdateProjectInput): Project => {
  if (!input.name.trim()) throw new Error('Project name is required');
  return repoUpdateProject(input.id, {
    name: input.name.trim(),
    description: input.description.trim(),
    color: input.color
  });
});

export const archiveProjectAction = defineAction((id: string): Project => {
  return repoUpdateProject(id, { status: 'archived' });
});
