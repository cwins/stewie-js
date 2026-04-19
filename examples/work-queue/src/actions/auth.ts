// Auth actions — login and logout.
//
// These are plain functions; they do not return data. The caller navigates
// after calling them so the page re-renders with the new auth state.

import { signIn, signOut } from '../data/mocks/auth.js';

export function login(username: string, _password: string): void {
  // Demo: any non-empty username is accepted. A real app would verify
  // credentials against a database and set a signed session cookie.
  if (!username.trim()) throw new Error('Username is required');
  signIn(username.trim());
}

export function logout(): void {
  signOut();
}
