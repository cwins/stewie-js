// Domain types for the Work Queue app.
//
// These are the stable, framework-independent definitions.
// Nothing in this file imports from @stewie-js/*; it is safe to import
// from loaders, actions, pages, and tests without pulling in reactivity.

export type ProjectStatus = 'active' | 'archived';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type UserRole = 'admin' | 'member';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  /** Hex color string used for visual accent on project cards. */
  color: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** ISO date string (YYYY-MM-DD) or null. */
  dueDate: string | null;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

// Full user record — stored server-side, exposed only to the user themselves.
export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  timezone: string;
  role: UserRole;
  /** Hex color string used as an avatar fallback when no image is set. */
  avatarColor: string;
  createdAt: string;
}

// Public subset — what other users can see. Sensitive fields (email, timezone,
// role, createdAt) are omitted at the API boundary, not just hidden in the UI.
export type UserPublic = Pick<User, 'id' | 'username' | 'displayName' | 'bio' | 'avatarColor'>;

// API result type for a single-user read. The discriminant `view` makes the
// self-vs-public branch explicit at every consumer, so the UI cannot
// accidentally read a sensitive field on a public-view record (it isn't there).
export type UserView = (User & { view: 'self' }) | (UserPublic & { view: 'public' });

// What every API call needs to know about who is asking. Used by the API
// client to apply restrictions; passed explicitly by callers (no implicit
// propagation in v1 — that's a later decision).
export interface Viewer {
  id: string;
  role: UserRole;
}
