/// <reference types="vite/client" />
import type { JSXElement, Reactive } from '@stewie-js/core';
import type { UserPublic } from '../../data/types.js';

interface UserChipProps {
  // Accessor-typed reactive prop (ADR 0004). Callers pass a live lookup
  // (`() => usersById()[id]`) or a constant thunk (`() => lead`) for a static
  // value. Accessor-only — not `T | (() => T)` — so there's no static arm a
  // caller could pass by mistake and silently lose reactivity.
  user: Reactive<UserPublic | null>;
  /** Display variant. `compact` hides the name and shows only the avatar. */
  variant?: 'default' | 'compact';
}

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserChip({ user, variant = 'default' }: UserChipProps): JSXElement {
  return (
    <span class={() => `user-chip user-chip-${variant}`} data-testid="user-chip">
      {() => {
        const u = user();
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
