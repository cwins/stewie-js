/// <reference types="vite/client" />
// Profile edit page — route: /profile/:userId/edit
//
// Reachable only by the profile owner — the route guard redirects other
// viewers to the read-only view. Even so, the API client re-checks the
// constraint at the boundary: if the client were forged, the request would
// still fail with a 403. The UI does not police access.

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, For, Show, useAction } from '@stewie-js/core';
import { useRouteData, useRouter, Link } from '@stewie-js/router';
import { updateProfileAction } from '../actions/users.js';
import { PROJECT_COLORS } from '../data/colors.js';
import type { ProfileEditData } from '../loaders/profile-edit.js';

// Static list of timezones for the demo. A real app would source these from
// Intl.supportedValuesOf('timeZone'), but a curated list keeps the picker
// usable in a select.
const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney'
];

export function ProfileEditPage(): JSXElement {
  const { user } = useRouteData<ProfileEditData>();
  const router = useRouter();

  const $displayName = signal(user.displayName);
  const $email = signal(user.email);
  const $bio = signal(user.bio);
  const $timezone = signal(user.timezone);
  const $avatarColor = signal(user.avatarColor);

  const save = useAction(updateProfileAction);

  const isValid = computed(() => $displayName().trim().length > 0 && $email().trim().length > 0);

  const hasChanges = computed(
    () =>
      $displayName() !== user.displayName ||
      $email() !== user.email ||
      $bio() !== user.bio ||
      $timezone() !== user.timezone ||
      $avatarColor() !== user.avatarColor
  );

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isValid()) return;

    const result = await save.run({
      targetId: user.id,
      updates: {
        displayName: $displayName.peek(),
        email: $email.peek(),
        bio: $bio.peek(),
        timezone: $timezone.peek(),
        avatarColor: $avatarColor.peek()
      }
    });
    if (result === undefined) return;

    await router.navigate(`/profile/${user.id}`);
  };

  return (
    <main class="page page-narrow" data-testid="profile-edit-page">
      <div class="page-header">
        <Link to={`/profile/${user.id}`} class="back-link" data-testid="back-link">
          ← Profile
        </Link>
        <h1 class="page-title">Edit profile</h1>
      </div>

      <div class="form-card">
        <form onSubmit={handleSubmit} data-testid="edit-profile-form">
          <Show when={() => save.error() !== null}>
            {() => (
              <p class="form-error" role="alert" data-testid="form-error">
                {() => save.error()?.message ?? ''}
              </p>
            )}
          </Show>

          <div class="field-group">
            <label class="field-label" for="profile-display-name">
              Display name <span aria-hidden="true">*</span>
            </label>
            <input
              id="profile-display-name"
              class="field-input"
              type="text"
              value={$displayName()}
              onInput={(e: InputEvent) => $displayName.set((e.target as HTMLInputElement).value)}
              data-testid="display-name-input"
              required
              autoFocus
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="profile-email">
              Email <span aria-hidden="true">*</span>
            </label>
            <input
              id="profile-email"
              class="field-input"
              type="email"
              value={$email()}
              onInput={(e: InputEvent) => $email.set((e.target as HTMLInputElement).value)}
              data-testid="email-input"
              required
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="profile-bio">
              Bio
            </label>
            <textarea
              id="profile-bio"
              class="field-input field-textarea"
              value={$bio()}
              onInput={(e: InputEvent) => $bio.set((e.target as HTMLTextAreaElement).value)}
              data-testid="bio-input"
            />
          </div>

          <div class="field-group">
            <label class="field-label" for="profile-timezone">
              Timezone
            </label>
            <select
              id="profile-timezone"
              class="field-select"
              value={$timezone()}
              onChange={(e: Event) => $timezone.set((e.target as HTMLSelectElement).value)}
              data-testid="timezone-select"
            >
              {TIMEZONES.map((tz) => <option value={tz}>{tz}</option>)}
            </select>
          </div>

          <div class="field-group">
            <span class="field-label">Avatar color</span>
            <div class="color-picker" role="radiogroup" aria-label="Avatar color">
              <For each={PROJECT_COLORS} by={(c) => c.value}>
                {(getColor) => (
                  <label class="color-swatch-label" title={getColor().label}>
                    <input
                      type="radio"
                      name="avatarColor"
                      value={getColor().value}
                      checked={() => $avatarColor() === getColor().value}
                      onChange={() => $avatarColor.set(getColor().value)}
                      class="color-swatch-input"
                      aria-label={getColor().label}
                    />
                    <span
                      class={() => `color-swatch${$avatarColor() === getColor().value ? ' color-swatch-selected' : ''}`}
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
              disabled={() => !isValid() || !hasChanges() || save.pending()}
              data-testid="save-profile-btn"
            >
              {() => (save.pending() ? 'Saving…' : 'Save changes')}
            </button>
            <Link to={`/profile/${user.id}`} class="btn btn-ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
