// User mutations.
//
// The profile edit form goes through here. The action resolves the current
// viewer at run time and passes it explicitly to the API client, which
// enforces self-only at the data boundary. The UI does not need to police
// access — even a client-side bug or forged request hits the boundary
// check and bounces.

import { defineAction } from '@stewie-js/core';
import { updateProfile, type UpdateProfileInput } from '../api/users.js';
import { getViewer } from '../data/mocks/auth.js';
import type { UserView } from '../data/types.js';

export interface UpdateProfileActionInput {
  targetId: string;
  updates: UpdateProfileInput;
}

export const updateProfileAction = defineAction(async (input: UpdateProfileActionInput): Promise<UserView> => {
  const viewer = getViewer();
  if (!viewer) throw new Error('You must be signed in to edit a profile');
  return updateProfile(viewer, input.targetId, input.updates);
});
