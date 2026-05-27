// Loader for the edit-project route: /projects/:projectId/edit
//
// Stable layer — only reads from the repo and returns domain types.
// No Stewie imports; safe to test without a running framework.

import { getProject } from '../data/mocks/repo.js';
import { getViewer } from '../data/mocks/auth.js';
import { listUsers } from '../api/users.js';
import type { Project, UserPublic } from '../data/types.js';

export interface ProjectEditData {
  project: Project;
  users: UserPublic[];
}

export async function projectEditLoader(params: Record<string, string>): Promise<ProjectEditData> {
  const project = getProject(params.projectId);
  if (!project) throw new Error(`Project "${params.projectId}" not found`);
  const users = await listUsers(getViewer());
  return { project, users };
}
