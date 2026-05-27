/// <reference types="vite/client" />
// Profile view page — route: /profile/:userId
//
// Renders the user record limited to what the viewer is allowed to see.
// The UserView union has two arms — `self` (full record) and `public`
// (limited subset). Branching on `view` lets the component reach the
// sensitive fields only on the self arm; on the public arm they are not
// part of the type, so a typo or refactor cannot accidentally leak them.

import type { JSXElement } from '@stewie-js/core';
import { Link } from '@stewie-js/router';
import { useRouteData } from '@stewie-js/router';
import type { ProfileViewData } from '../loaders/profile-view.js';

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileViewPage(): JSXElement {
  const { user } = useRouteData<ProfileViewData>();
  const isSelf = user.view === 'self';

  return (
    <main class="page page-narrow" data-testid={`profile-view-${user.id}`}>
      <div class="page-header">
        <h1 class="page-title">{isSelf ? 'Your profile' : user.displayName}</h1>
      </div>

      <div class="profile-card">
        <div class="profile-card-header">
          <span class="profile-avatar" style={`background-color: ${user.avatarColor}`} aria-hidden="true" data-testid="profile-avatar">
            {initials(user.displayName)}
          </span>
          <div class="profile-card-identity">
            <p class="profile-display-name" data-testid="profile-display-name">
              {user.displayName}
            </p>
            <p class="profile-username">@{user.username}</p>
          </div>
          {user.view === 'self' ? (
            <Link to={`/profile/${user.id}/edit`} class="btn btn-ghost btn-sm" data-testid="edit-profile-link">
              Edit profile
            </Link>
          ) : null}
        </div>

        <dl class="profile-fields">
          <div class="profile-field">
            <dt class="profile-field-label">Bio</dt>
            <dd class="profile-field-value" data-testid="profile-bio">
              {user.bio || <span class="profile-field-empty">No bio yet.</span>}
            </dd>
          </div>

          {user.view === 'self' ? (
            <>
              <div class="profile-field">
                <dt class="profile-field-label">Email</dt>
                <dd class="profile-field-value" data-testid="profile-email">
                  {user.email}
                </dd>
              </div>
              <div class="profile-field">
                <dt class="profile-field-label">Timezone</dt>
                <dd class="profile-field-value" data-testid="profile-timezone">
                  {user.timezone}
                </dd>
              </div>
              <div class="profile-field">
                <dt class="profile-field-label">Role</dt>
                <dd class="profile-field-value" data-testid="profile-role">
                  {user.role}
                </dd>
              </div>
              <div class="profile-field">
                <dt class="profile-field-label">Member since</dt>
                <dd class="profile-field-value" data-testid="profile-joined">
                  {new Date(user.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </>
          ) : (
            <div class="profile-field">
              <dt class="profile-field-label">Contact</dt>
              <dd class="profile-field-value profile-field-empty" data-testid="profile-contact-hidden">
                Email and timezone are visible only to the profile owner.
              </dd>
            </div>
          )}
        </dl>
      </div>
    </main>
  );
}
