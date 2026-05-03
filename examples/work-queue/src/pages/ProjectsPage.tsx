/// <reference types="vite/client" />
// Projects list page — route: /projects
//
// Teaching points:
//   - Route loader data via useRouteData<ProjectsData>()
//   - signal() for local UI state — search query lives here, not in the loader
//   - computed() for the filtered list derived from signal + loader data
//   - For over loader-provided array
//   - Link-based navigation (no imperative router.navigate)
//
// The search filter is intentionally local state (signal + computed), not a
// URL query param. It resets on navigation, which is the right default for
// ephemeral UI state. Persisting it to the URL would require updating the
// loader to read from query params — a separate teaching example.

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, For, Show } from '@stewie-js/core';
import { useRouteData, Link } from '@stewie-js/router';
import type { ProjectsData } from '../loaders/projects.js';
import { EmptyState } from '../components/lib/EmptyState.js';

export function ProjectsPage(): JSXElement {
  const data = useRouteData<ProjectsData>();
  const projects = data.projects;

  // Local search state — signal() for the query, computed() for the filtered list.
  // This is client-only filtering: the full list is already in the loader data,
  // so no round-trip to the server is needed.
  const $search = signal('');
  const filteredProjects = computed(() => {
    const q = $search().toLowerCase().trim();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  });

  return (
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
        <>
          <div class="filter-bar" data-testid="filter-bar">
            <input
              class="field-input filter-search"
              type="search"
              placeholder="Filter projects…"
              value={$search()}
              onInput={(e: InputEvent) => $search.set((e.target as HTMLInputElement).value)}
              aria-label="Filter projects by name or description"
              data-testid="project-search"
            />
          </div>

          <Show
            when={() => filteredProjects().length > 0}
            fallback={<EmptyState title="No matches" description="Try a different search term." testId="projects-no-match" />}
          >
            {() => (
              <div class="project-list" data-testid="project-list">
                <For each={filteredProjects} by={(p) => p.id}>
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
                            <span class="project-list-task-count">{() => `${counts().total} task${counts().total !== 1 ? 's' : ''}`}</span>
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
          </Show>
        </>
      )}
    </main>
  );
}
