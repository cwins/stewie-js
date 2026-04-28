// Auth actions — login and logout.
//
// defineAction at module scope (no signals created — safe). useAction() inside
// the component creates the per-component pending/error instance.

import { defineAction } from '@stewie-js/core';
import { signIn, signOut } from '../data/mocks/auth.js';

export interface LoginInput {
  username: string;
  password: string;
}

export const loginAction = defineAction(({ username }: LoginInput): void => {
  // Demo: any non-empty username is accepted. A real app would verify
  // credentials against a database and set a signed session cookie.
  if (!username.trim()) throw new Error('Username is required');
  signIn(username.trim());
});

export const logoutAction = defineAction((): void => {
  signOut();
});
