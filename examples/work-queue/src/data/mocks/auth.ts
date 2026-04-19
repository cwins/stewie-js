// In-memory auth state for the Work Queue example.
//
// This module is the server-side auth singleton — the same pattern as repo.ts
// for data. On the server it is shared across requests (fine for a demo).
// On the client it is an independent in-memory copy.
//
// A real app would use cookies/session tokens so the server can verify the
// caller on every request. The guard pattern demonstrated here is identical
// regardless of the underlying session mechanism.

interface Session {
  isAuthenticated: boolean;
  username: string | null;
}

const session: Session = { isAuthenticated: false, username: null };

export function getSession(): Readonly<Session> {
  return { ...session };
}

export function isAuthenticated(): boolean {
  return session.isAuthenticated;
}

export function signIn(username: string): void {
  session.isAuthenticated = true;
  session.username = username;
}

export function signOut(): void {
  session.isAuthenticated = false;
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
