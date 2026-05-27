// Profile view route loader: /profile/:userId
//
// Returns the discriminated UserView. The page branches on `view` to render
// the full self-view or the limited public view — the union forces the
// component to handle both cases at compile time.

import { getViewer } from '../data/mocks/auth.js';
import { getUser } from '../api/users.js';
import type { UserView } from '../data/types.js';

export interface ProfileViewData {
  user: UserView;
}

export async function profileViewLoader(params: Record<string, string>): Promise<ProfileViewData> {
  const viewer = getViewer();
  if (!viewer) throw new Error('Unauthenticated');
  const user = await getUser(viewer, params.userId);
  return { user };
}
