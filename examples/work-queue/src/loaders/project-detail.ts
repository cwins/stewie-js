// Project detail route loader.
//
// Loads a single project and its tasks for the /projects/:projectId route.
// The loader receives matched URL params — `params.projectId` is the dynamic
// segment from the route pattern.

import { getProject, getTasksForProject } from '../data/mocks/repo.js';
import { getViewer } from '../data/mocks/auth.js';
import { listUsers } from '../api/users.js';
import type { Project, Task, UserPublic } from '../data/types.js';

export interface ProjectDetailData {
  project: Project;
  tasks: Task[];
  users: UserPublic[];
}

export async function projectDetailLoader(params: Record<string, string>): Promise<ProjectDetailData> {
  const project = getProject(params.projectId);
  if (!project) {
    // In a real app, throw a typed NotFoundError that the router or error
    // boundary handles and maps to an HTTP 404 response.
    throw new Error(`Project "${params.projectId}" not found`);
  }
  // listUsers returns the public list; passing the viewer is for future
  // scoping (e.g. workspace-scoped visibility), not for restricting fields.
  const users = await listUsers(getViewer());
  return {
    project,
    tasks: getTasksForProject(params.projectId),
    users
  };
}
