/// <reference types="vite/client" />
// Projects list page — route: /projects
//
// Teaching points:
//   - Route loader data via useRouteData<ProjectsData>()
//   - computed() for derived display (search/filter is Phase 2)
//   - For over loader-provided array
//   - Link-based navigation (no imperative router.navigate)

import type { JSXElement } from '@stewie-js/core';
import { For } from '@stewie-js/core';
import { useRouteData, Link } from '@stewie-js/router';
import { AppShell } from '../components/AppShell.js';
import type { ProjectsData } from '../loaders/projects.js';
import { EmptyState } from '../components/lib/EmptyState.js';

export function ProjectsPage(): JSXElement {
  const data = useRouteData<ProjectsData>();
  const projects = data.projects;

  return (
    <AppShell>
    <main class="page" data-testid="projects-page">
      <div class="page-header">
        <h1 class="page-title">Projects</h1>
        <Link to="/projects/new" class="btn btn-primary" data-testid="new-project-btn">
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start tracking work."
          testId="projects-empty"
          action={
            <Link to="/projects/new" class="btn btn-primary">
              New Project
            </Link>
          }
        />
      ) : (
        <div class="project-list" data-testid="project-list">
          <For each={projects} by={(p) => p.id}>
            {(getProject) => {
              const counts = () => getProject().taskCounts;
              return (
                <Link
                  to={`/projects/${getProject().id}`}
                  class="project-list-item"
                  data-testid={`project-list-item-${getProject().id}`}
                >
                  <div class="project-list-accent" style={() => `background: ${getProject().color}`} />
                  <div class="project-list-body">
                    <div class="project-list-header">
                      <span class="project-list-name">{() => getProject().name}</span>
                      <span class="project-list-task-count">
                        {() => `${counts().total} task${counts().total !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <p class="project-list-desc">{() => getProject().description}</p>
                    <div class="project-list-progress" aria-label="Task progress">
                      <span class="progress-pill progress-todo">{() => `${counts().todo} to do`}</span>
                      <span class="progress-pill progress-in-progress">{() => `${counts().inProgress} in progress`}</span>
                      <span class="progress-pill progress-done">{() => `${counts().done} done`}</span>
                    </div>
                  </div>
                </Link>
              );
            }}
          </For>
        </div>
      )}
    </main>
    </AppShell>
  );
}
