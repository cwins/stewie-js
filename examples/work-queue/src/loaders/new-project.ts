// Loader for the new-project route: /projects/new
//
// The form itself is mostly empty — but the lead picker needs the user
// directory. Loading it via the route loader keeps the data fetch out of
// the component and aligns with the rest of the app's loader-first pattern.

import { getViewer } from '../data/mocks/auth.js';
import { listUsers } from '../api/users.js';
import type { UserPublic } from '../data/types.js';

export interface NewProjectData {
  users: UserPublic[];
}

export async function newProjectLoader(): Promise<NewProjectData> {
  const users = await listUsers(getViewer());
  return { users };
}
