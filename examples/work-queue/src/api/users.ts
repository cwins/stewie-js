// User API — read access with viewer-based field restrictions.
//
// The single-user read returns a UserView discriminated by `view`. When the
// viewer is asking about themselves, the response includes the full record;
// when asking about anyone else, sensitive fields (email, timezone, role,
// createdAt) are omitted at the API boundary. The TypeScript discriminant
// forces every UI consumer to branch on which view they received, so a
// component cannot accidentally read `email` on a public-view record (the
// field is not present on that arm of the union).

import { getAllUsers, getUserById } from '../data/mocks/repo.js';
import type { User, UserPublic, UserView, Viewer } from '../data/types.js';
import { notFound, simulateLatency } from './client.js';

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
