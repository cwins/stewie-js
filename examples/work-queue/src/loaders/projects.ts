// Projects list route loader.
//
// Fetches all active projects along with task counts for the list view.
// No URL params — the projects list shows everything.

import { getProjects, getTaskCountsForProject } from '../data/repo.js';
import type { ProjectTaskCounts } from '../data/repo.js';
import type { Project } from '../data/types.js';

export interface ProjectWithCounts extends Project {
  taskCounts: ProjectTaskCounts;
}

export interface ProjectsData {
  projects: ProjectWithCounts[];
}

export async function projectsLoader(): Promise<ProjectsData> {
  const active = getProjects('active');
  return {
    projects: active.map((p) => ({
      ...p,
      taskCounts: getTaskCountsForProject(p.id)
    }))
  };
}
