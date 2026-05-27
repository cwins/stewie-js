// User API — read access with viewer-based field restrictions.
//
// The single-user read returns a UserView discriminated by `view`. When the
// viewer is asking about themselves, the response includes the full record;
// when asking about anyone else, sensitive fields (email, timezone, role,
// createdAt) are omitted at the API boundary. The TypeScript discriminant
// forces every UI consumer to branch on which view they received, so a
// component cannot accidentally read `email` on a public-view record (the
// field is not present on that arm of the union).

import { getAllUsers, getUserById, updateUser as repoUpdateUser } from '../data/mocks/repo.js';
import type { User, UserPublic, UserView, Viewer } from '../data/types.js';
import { forbidden, notFound, simulateLatency } from './client.js';

function toPublicView(user: User): UserView {
  const publicFields: UserPublic = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarColor: user.avatarColor
  };
  return { view: 'public', ...publicFields };
}

function toSelfView(user: User): UserView {
  return { view: 'self', ...user };
}

export async function getUser(viewer: Viewer, targetId: string): Promise<UserView> {
  await simulateLatency();
  const user = getUserById(targetId);
  if (!user) throw notFound(`User ${targetId} not found`);
  return viewer.id === user.id ? toSelfView(user) : toPublicView(user);
}

// Lists every user the viewer can see. Today this is "all users, public view"
// — the picker, the directory page, and any tooltip resolver share this one
// shape. Viewer is accepted for parity with getUser and reserved for future
// scoping (workspace membership, blocked users, etc.). Today every caller
// gets the same public list, including unauthenticated callers — the return
// type is UserPublic[], which is public by definition.
export interface UpdateProfileInput {
  displayName: string;
  email: string;
  bio: string;
  timezone: string;
  avatarColor: string;
}

// Self-edit only — the API rejects an attempt to edit someone else's profile
// at the boundary, so a UI bug or a forged client request cannot escalate.
// Always returns the full self-view because the caller is, by definition,
// looking at their own record.
export async function updateProfile(viewer: Viewer, targetId: string, updates: UpdateProfileInput): Promise<UserView> {
  await simulateLatency();
  if (viewer.id !== targetId) throw forbidden('You can only edit your own profile');
  const existing = getUserById(targetId);
  if (!existing) throw notFound(`User ${targetId} not found`);
  const trimmed: UpdateProfileInput = {
    displayName: updates.displayName.trim(),
    email: updates.email.trim(),
    bio: updates.bio.trim(),
    timezone: updates.timezone.trim(),
    avatarColor: updates.avatarColor
  };
  if (!trimmed.displayName) throw new Error('Display name is required');
  if (!trimmed.email) throw new Error('Email is required');
  const saved = repoUpdateUser(targetId, trimmed);
  return { view: 'self', ...saved };
}

export async function listUsers(_viewer: Viewer | null): Promise<UserPublic[]> {
  await simulateLatency();
  return getAllUsers().map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarColor: u.avatarColor
  }));
}
