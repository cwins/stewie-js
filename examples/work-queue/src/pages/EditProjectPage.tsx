/// <reference types="vite/client" />
// Edit project page — route: /projects/:projectId/edit
//
// Teaching points:
//   - Same form pattern as NewProjectPage, but pre-populated from loader data
//   - signal() seeded with existing values (not empty strings)
//   - computed() for derived validation state
//   - Navigate-to-refresh: update → navigate back to project detail → loader re-fires
//   - Archive (soft-delete) as a destructive action with confirm guard

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, Show, For } from '@stewie-js/core';
import { useRouteData, useParams, useRouter, Link } from '@stewie-js/router';
import { AppShell } from '../components/AppShell.js';
import { updateProject, archiveProject } from '../actions/projects.js';
import { PROJECT_COLORS } from '../data/colors.js';
import type { ProjectEditData } from '../loaders/project-edit.js';

export function EditProjectPage(): JSXElement {
  const { projectId } = useParams<{ projectId: string }>();
  const { project } = useRouteData<ProjectEditData>();
  const router = useRouter();

  // Form signals seeded from loader data — not empty defaults.
  // This is the canonical pattern for edit forms vs create forms.
  const $name = signal(project.name);
  const $description = signal(project.description);
  const $color = signal(project.color);
  const $submitting = signal(false);
  const $error = signal('');
  const $confirmArchive = signal(false);

  const isValid = computed(() => $name().trim().length > 0);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isValid()) return;

    $submitting.set(true);
    $error.set('');
    try {
      updateProject(projectId, {
        name: $name(),
        description: $description(),
        color: $color()
      });
      // Navigate-to-refresh: the project detail loader re-runs on arrival
      // and renders the updated project name, description, and color.
      await router.navigate(`/projects/${projectId}`);
    } catch (err) {
      $error.set(err instanceof Error ? err.message : 'Failed to save project');
      $submitting.set(false);
    }
  };

  const handleArchive = async () => {
    try {
      archiveProject(projectId);
      await router.navigate('/projects');
    } catch (err) {
      $error.set(err instanceof Error ? err.message : 'Failed to archive project');
    }
  };

  return (
    <AppShell>
      <main class="page" data-testid="edit-project-page">
        <div class="page-header">
          <Link to={`/projects/${projectId}`} class="back-link" data-testid="back-link">
            {`← ${project.name}`}
          </Link>
          <h1 class="page-title">Edit Project</h1>
        </div>

        <div class="form-card">
          <form onSubmit={handleSubmit} data-testid="edit-project-form">
            <Show when={() => $error() !== ''}>
              {() => (
                <p class="form-error" role="alert" data-testid="form-error">
                  {$error()}
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
              <button type="submit" class="btn btn-primary" disabled={() => !isValid() || $submitting()} data-testid="save-project-btn">
                {() => ($submitting() ? 'Saving…' : 'Save Changes')}
              </button>
              <Link to={`/projects/${projectId}`} class="btn btn-ghost">
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Archive section — separate from the edit form to make the destructive
            nature clear. Two-step confirm prevents accidental archives. */}
        <div class="danger-zone" data-testid="danger-zone">
          <h2 class="danger-zone-title">Danger Zone</h2>
          <div class="danger-zone-row">
            <div>
              <p class="danger-zone-label">Archive this project</p>
              <p class="danger-zone-desc">Archived projects are hidden from the active list but not deleted.</p>
            </div>
            <Show
              when={$confirmArchive}
              fallback={
                <button
                  type="button"
                  class="btn btn-destructive-outline"
                  onClick={() => $confirmArchive.set(true)}
                  data-testid="archive-btn"
                >
                  Archive
                </button>
              }
            >
              {() => (
                <div class="confirm-row">
                  <span class="confirm-label">Are you sure?</span>
                  <button type="button" class="btn btn-destructive" onClick={handleArchive} data-testid="confirm-archive-btn">
                    Yes, archive
                  </button>
                  <button type="button" class="btn btn-ghost" onClick={() => $confirmArchive.set(false)} data-testid="cancel-archive-btn">
                    Cancel
                  </button>
                </div>
              )}
            </Show>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
