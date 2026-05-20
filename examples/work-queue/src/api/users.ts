// User API — read access with viewer-based field restrictions.
//
// The single-user read returns a UserView discriminated by `view`. When the
// viewer is asking about themselves, the response includes the full record;
// when asking about anyone else, sensitive fields (email, timezone, role,
// createdAt) are omitted at the API boundary. The TypeScript discriminant
// forces every UI consumer to branch on which view they received, so a
// component cannot accidentally read `email` on a public-view record (the
// field is not present on that arm of the union).

import { getUserById } from '../data/mocks/repo.js';
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
