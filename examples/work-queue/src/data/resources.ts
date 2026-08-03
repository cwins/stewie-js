/// <reference types="vite/client" />
// Shared resources — defineResource definitions safe to import anywhere.
//
// A resource is the right tool when a *reusable component* owns its own data
// and shouldn't depend on every route loader to supply it. The team panel in
// the app shell is the canonical case: it renders on every route, so threading
// the user list through each route's loader would be busywork. Instead the
// panel fetches via useResource(fetchUsers), independent of routing.
//
// Note the explicit { id }: without it, an auto-counter id would not be stable
// across the SSR and client builds, so the resource would refetch on hydration
// instead of replaying the SSR-resolved data (STW063).

import { defineResource } from '@stewie-js/core';
import { listUsers } from '../api/users.js';
import { getViewer } from './mocks/auth.js';
import type { UserPublic } from './types.js';

export const fetchUsers = defineResource<void, UserPublic[]>(() => listUsers(getViewer()), { id: 'fetchUsers' });
