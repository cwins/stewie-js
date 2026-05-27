// Profile edit route loader: /profile/:userId/edit
//
// Always returns the self-view, because the route guard only lets the
// owner reach this loader. Reusing getUser keeps the restriction shape
// consistent — the loader returns a UserView, not a raw User, so the page
// uses the same discriminant the view page uses.

import { getViewer } from '../data/mocks/auth.js';
import { getUser } from '../api/users.js';
import type { User } from '../data/types.js';

export interface ProfileEditData {
  user: User;
}

export async function profileEditLoader(params: Record<string, string>): Promise<ProfileEditData> {
  const viewer = getViewer();
  if (!viewer) throw new Error('Unauthenticated');
  const view = await getUser(viewer, params.userId);
  // The guard guarantees viewer.id === params.userId, so the response is the
  // self-view. Surface a plain User to the edit form (no discriminant noise).
  if (view.view !== 'self') throw new Error('Profile edit reached without self view');
  const { view: _view, ...user } = view;
  return { user };
}
