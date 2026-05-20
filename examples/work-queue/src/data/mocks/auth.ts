// In-memory auth state for the Work Queue example.
//
// This module is the server-side auth singleton — the same pattern as repo.ts
// for data. On the server it is shared across requests (fine for a demo).
// On the client it is an independent in-memory copy.
//
// A real app would use cookies/session tokens so the server can verify the
// caller on every request. The guard pattern demonstrated here is identical
// regardless of the underlying session mechanism.

import { getUserById, getUserByUsername } from './repo.js';
import type { Viewer } from '../types.js';

interface Session {
  isAuthenticated: boolean;
  userId: string | null;
  username: string | null;
}

const session: Session = { isAuthenticated: false, userId: null, username: null };

export function getSession(): Readonly<Session> {
  return { ...session };
}

export function isAuthenticated(): boolean {
  return session.isAuthenticated;
}

// Resolve the current viewer for API calls. Returns null when no one is
// signed in. Callers that pass this directly to API methods are responsible
// for handling the null case (typically by guarding the route with
// requireAuth so unauthenticated requests never reach the loader).
export function getViewer(): Viewer | null {
  if (!session.userId) return null;
  const user = getUserById(session.userId);
  if (!user) return null;
  return { id: user.id, role: user.role };
}

// Looks up the user by username and signs them in. Throws if no user with
// that username exists — the demo accepts alice, bob, or carol from the seed.
export function signIn(username: string): void {
  const user = getUserByUsername(username);
  if (!user) {
    throw new Error(`Unknown user "${username}". Try alice, bob, or carol.`);
  }
  session.isAuthenticated = true;
  session.userId = user.id;
  session.username = user.username;
}

export function signOut(): void {
  session.isAuthenticated = false;
  session.userId = null;
  session.username = null;
}

// ---------------------------------------------------------------------------
// requireAuth — route guard for protected pages.
//
// Return true to allow navigation; return a redirect URL string to block it.
// The router calls this before rendering the matched route on both the server
// (via createSsrRouter) and the client (via navigate()).
// ---------------------------------------------------------------------------

export async function requireAuth(_to: string, _from: string): Promise<true | string> {
  if (isAuthenticated()) return true;
  return `/login?redirect=${encodeURIComponent(_to)}`;
}
