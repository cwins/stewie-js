// Loader for the edit-project route: /projects/:projectId/edit
//
// Stable layer — only reads from the repo and returns domain types.
// No Stewie imports; safe to test without a running framework.

import { getProject } from '../data/mocks/repo.js';
import type { Project } from '../data/types.js';

export interface ProjectEditData {
  project: Project;
}

export async function projectEditLoader(params: Record<string, string>): Promise<ProjectEditData> {
  const project = getProject(params.projectId);
  if (!project) throw new Error(`Project "${params.projectId}" not found`);
  return { project };
}
