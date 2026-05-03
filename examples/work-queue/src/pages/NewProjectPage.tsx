/// <reference types="vite/client" />
// New project page — route: /projects/new
//
// Teaching points:
//   - signal() for all form field state
//   - computed() for validation state
//   - useAction() creates the per-component pending/error instance
//   - Navigate-to-refresh: create → navigate(/projects/:id) → loader fires fresh
//   - signal.peek() to snapshot form state at call site (no live read inside run())

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, Show, For, useAction } from '@stewie-js/core';
import { useRouter, Link } from '@stewie-js/router';
import { createProjectAction } from '../actions/projects.js';
import { PROJECT_COLORS } from '../data/colors.js';

export function NewProjectPage(): JSXElement {
  const router = useRouter();

  const $name = signal('');
  const $description = signal('');
  const $color = signal(PROJECT_COLORS[0].value);

  // Derived: form is valid when name is non-empty
  const isValid = computed(() => $name().trim().length > 0);

  const create = useAction(createProjectAction);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isValid()) return;

    const result = await create.run({
      name: $name.peek(),
      description: $description.peek(),
      color: $color.peek()
    });
    if (result === undefined) return;

    // Navigate-to-refresh: navigate to the new project's detail page.
    // The route loader runs on arrival and fetches fresh data from the repo.
    await router.navigate(`/projects/${result.id}`);
  };

  return (
    <main class="page" data-testid="new-project-page">
      <div class="page-header">
        <Link to="/projects" class="back-link">
          &larr; Projects
        </Link>
        <h1 class="page-title">New Project</h1>
      </div>

      <div class="form-card">
        <form onSubmit={handleSubmit} data-testid="new-project-form">
          <Show when={() => create.error() !== null}>
            {() => (
              <p class="form-error" role="alert" data-testid="form-error">
                {() => create.error()?.message ?? ''}
              </p>
            )}
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
            <label class="field-label" for="project-description">
              Description
            </label>
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
              disabled={() => !isValid() || create.pending()}
              data-testid="create-project-submit"
            >
              {() => (create.pending() ? 'Creating\u2026' : 'Create Project')}
            </button>
            <Link to="/projects" class="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
