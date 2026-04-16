/// <reference types="vite/client" />
// Dashboard page — route: /
//
// Data arrives via the dashboardLoader (src/loaders/dashboard.ts).
// useRouteData<DashboardData>() is the only way data enters this component;
// there is no prop-drilling and no global store access here.
//
// Teaching points:
//   - Route loaders as the primary initial-data mechanism
//   - useRouteData<T>() typed to the exact loader return type
//   - Derived display via computed()
//   - For and Show control flow

import type { JSXElement } from '@stewie-js/core';
import { computed, For } from '@stewie-js/core';
import { useRouteData, Link } from '@stewie-js/router';
import { AppShell } from '../components/AppShell.js';
import type { DashboardData } from '../loaders/dashboard.js';

export function DashboardPage(): JSXElement {
  // Data was loaded before this component rendered — no loading state needed here.
  // The router's fallback prop handles the loading state between navigations.
  const data = useRouteData<DashboardData>();

  const stats = data.stats;
  const projects = data.recentProjects;

  // Derived: completion percentage across all tasks
  const completionPct = computed(() => {
    if (stats.totalTasks === 0) return 0;
    return Math.round((stats.doneCount / stats.totalTasks) * 100);
  });

  return (
    <AppShell>
    <main class="page" data-testid="dashboard">
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
      </div>

      {/* Stats row */}
      <section class="stats-grid" aria-label="Summary statistics" data-testid="stats-grid">
        <div class="stat-card" data-testid="stat-projects">
          <span class="stat-value">{stats.totalProjects}</span>
          <span class="stat-label">Active Projects</span>
        </div>
        <div class="stat-card" data-testid="stat-todo">
          <span class="stat-value">{stats.todoCount}</span>
          <span class="stat-label">To Do</span>
        </div>
        <div class="stat-card" data-testid="stat-in-progress">
          <span class="stat-value">{stats.inProgressCount}</span>
          <span class="stat-label">In Progress</span>
        </div>
        <div class="stat-card" data-testid="stat-done">
          <span class="stat-value">{stats.doneCount}</span>
          <span class="stat-label">Done</span>
        </div>
        <div class="stat-card" data-testid="stat-completion">
          <span class="stat-value">{() => `${completionPct()}%`}</span>
          <span class="stat-label">Completion</span>
        </div>
      </section>

      {/* Recent projects */}
      <section aria-labelledby="recent-projects-heading">
        <div class="section-header">
          <h2 class="section-title" id="recent-projects-heading">Projects</h2>
          <Link to="/projects" class="section-link">View all →</Link>
        </div>
        <div class="project-grid" data-testid="project-grid">
          <For each={projects} by={(p) => p.id}>
            {(getProject) => (
              <Link to={`/projects/${getProject().id}`} class="project-card" data-testid={`project-card-${getProject().id}`}>
                <div class="project-card-accent" style={() => `background: ${getProject().color}`} />
                <div class="project-card-body">
                  <p class="project-card-name">{() => getProject().name}</p>
                  <p class="project-card-desc">{() => getProject().description}</p>
                </div>
              </Link>
            )}
          </For>
          <Link to="/projects/new" class="project-card project-card-new" data-testid="new-project-card">
            <span class="project-card-new-icon">+</span>
            <span>New Project</span>
          </Link>
        </div>
      </section>
    </main>
    </AppShell>
  );
}
