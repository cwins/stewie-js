/// <reference types="vite/client" />
import type { JSXElement } from '@stewie-js/core';
import type { UserPublic } from '../../data/types.js';

interface UserChipProps {
  // Accepts a plain value or accessor so callers can pass either a stable
  // loader value or a reactive lookup (e.g. () => userMap[task().assigneeId]).
  user: UserPublic | null | (() => UserPublic | null);
  /** Display variant. `compact` hides the name and shows only the avatar. */
  variant?: 'default' | 'compact';
}

function resolve<T>(v: T | (() => T)): () => T {
  return typeof v === 'function' ? (v as () => T) : () => v;
}

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserChip({ user, variant = 'default' }: UserChipProps): JSXElement {
  const get = resolve(user);
  return (
    <span class={() => `user-chip user-chip-${variant}`} data-testid="user-chip">
      {() => {
        const u = get();
        if (!u) {
          return (
            <>
              <span class="user-chip-avatar user-chip-avatar-empty" aria-hidden="true">
                ?
              </span>
              {variant === 'default' ? <span class="user-chip-name user-chip-name-empty">Unassigned</span> : null}
            </>
          );
        }
        return (
          <>
            <span class="user-chip-avatar" style={`background-color: ${u.avatarColor}`} aria-hidden="true">
              {initials(u.displayName)}
            </span>
            {variant === 'default' ? <span class="user-chip-name">{u.displayName}</span> : null}
          </>
        );
      }}
    </span>
  );
}
