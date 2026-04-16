// Dashboard route loader.
//
// Route loaders run on the server before the route component renders (SSR),
// and also on the client when navigating to the route. The result is available
// inside the component via useRouteData<DashboardData>().
//
// Loaders receive matched URL params and query as arguments, though the
// dashboard has no dynamic segments — it receives empty objects.

import { getStats, getProjects } from '../data/repo.js';
import type { AppStats } from '../data/repo.js';
import type { Project } from '../data/types.js';

export interface DashboardData {
  stats: AppStats;
  recentProjects: Project[];
}

export async function dashboardLoader(): Promise<DashboardData> {
  return {
    stats: getStats(),
    recentProjects: getProjects('active').slice(0, 6)
  };
}
