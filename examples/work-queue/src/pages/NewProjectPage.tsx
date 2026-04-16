/// <reference types="vite/client" />
// New project page — route: /projects/new
//
// Teaching points:
//   - signal() for all form field state
//   - computed() for validation state
//   - Navigate-to-refresh: create → navigate(/projects/:id) → loader fires fresh
//   - Pending/error/success state via local signals (no external state manager)

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, Show, For } from '@stewie-js/core';
import { useRouter, Link } from '@stewie-js/router';
import { AppShell } from '../components/AppShell.js';
import { createProject } from '../actions/projects.js';

const PROJECT_COLORS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#0ea5e9', label: 'Sky' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Violet' }
];

export function NewProjectPage(): JSXElement {
  const router = useRouter();

  const $name = signal('');
  const $description = signal('');
  const $color = signal(PROJECT_COLORS[0].value);
  const $submitting = signal(false);
  const $error = signal('');

  // Derived: form is valid when name is non-empty
  const isValid = computed(() => $name().trim().length > 0);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isValid()) return;

    $submitting.set(true);
    $error.set('');
    try {
      const project = createProject({
        name: $name(),
        description: $description(),
        color: $color()
      });
      // Navigate-to-refresh: navigate to the new project's detail page.
      // The route loader runs on arrival and fetches fresh data from the repo.
      await router.navigate(`/projects/${project.id}`);
    } catch (err) {
      $error.set(err instanceof Error ? err.message : 'Failed to create project');
      $submitting.set(false);
    }
  };

  return (
    <AppShell>
    <main class="page" data-testid="new-project-page">
      <div class="page-header">
        <Link to="/projects" class="back-link">← Projects</Link>
        <h1 class="page-title">New Project</h1>
      </div>

      <div class="form-card">
        <form onSubmit={handleSubmit} data-testid="new-project-form">
          <Show when={() => $error() !== ''}>
            {() => <p class="form-error" role="alert" data-testid="form-error">{$error()}</p>}
          </Show>

          <div class="field-group">
            <label class="field-label" for="project-name">
              Project Name <span aria-hidden="true">*</span>
            </label>
            <input
              id="project-name"
              class="field-input"
              type="text"
              placeholder="e.g. Platform Migration"
              value={$name()}
              onInput={(e: InputEvent) => $name.set((e.target as HTMLInputElement).value)}
              data-testid="project-name-input"
              required
              autoFocus
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="project-description">Description</label>
            <textarea
              id="project-description"
              class="field-input field-textarea"
              placeholder="What is this project about?"
              value={$description()}
              onInput={(e: InputEvent) => $description.set((e.target as HTMLTextAreaElement).value)}
              data-testid="project-description-input"
            />
          </div>

          <div class="field-group">
            <span class="field-label">Color</span>
            <div class="color-picker" role="radiogroup" aria-label="Project color">
              <For each={PROJECT_COLORS} by={(c) => c.value}>
                {(getColor) => (
                  <label class="color-swatch-label" title={getColor().label}>
                    <input
                      type="radio"
                      name="color"
                      value={getColor().value}
                      checked={() => $color() === getColor().value}
                      onChange={() => $color.set(getColor().value)}
                      class="color-swatch-input"
                      aria-label={getColor().label}
                    />
                    <span
                      class={() => `color-swatch${$color() === getColor().value ? ' color-swatch-selected' : ''}`}
                      style={() => `background: ${getColor().value}`}
                    />
                  </label>
                )}
              </For>
            </div>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary"
              disabled={() => !isValid() || $submitting()}
              data-testid="create-project-submit"
            >
              {() => ($submitting() ? 'Creating…' : 'Create Project')}
            </button>
            <Link to="/projects" class="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
    </AppShell>
  );
}
