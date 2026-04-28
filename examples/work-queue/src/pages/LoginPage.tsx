/// <reference types="vite/client" />
// Login page — route: /login
//
// Teaching points:
//   - Plain form + defineAction/useAction pattern (no special framework form API)
//   - signal() for form field state
//   - computed() for validation
//   - useAction() creates the per-component pending/error instance
//   - Post-login redirect: read ?redirect= from query, navigate there on success
//   - The auth guard in app.tsx sets ?redirect= before sending here

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, Show, useAction } from '@stewie-js/core';
import { useRouter, useQuery } from '@stewie-js/router';
import { AppShell } from '../components/AppShell.js';
import { loginAction } from '../actions/auth.js';

export function LoginPage(): JSXElement {
  const router = useRouter();
  const query = useQuery<{ redirect?: string }>();

  const $username = signal('');
  const $password = signal('');

  const isValid = computed(() => $username().trim().length > 0 && $password().length > 0);

  const login = useAction(loginAction);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isValid()) return;

    await login.run({
      username: $username.peek(),
      password: $password.peek()
    });
    if (login.lastRun() !== 'success') return;

    // Navigate to the originally-requested URL, or the dashboard.
    const redirectTo = query.redirect ?? '/';
    await router.navigate(redirectTo);
  };

  return (
    <AppShell>
      <main class="page page-narrow" data-testid="login-page">
        <div class="page-header">
          <h1 class="page-title">Sign in</h1>
        </div>
        <p class="page-subtitle">Demo: use any username and any non-empty password.</p>

        <div class="form-card">
          <form onSubmit={handleSubmit} data-testid="login-form">
            <Show when={() => login.error() !== null}>
              {() => (
                <p class="form-error" role="alert" data-testid="login-error">
                  {() => login.error()?.message ?? ''}
                </p>
              )}
            </Show>

            <div class="field-group">
              <label class="field-label" for="username">
                Username
              </label>
              <input
                id="username"
                class="field-input"
                type="text"
                placeholder="e.g. alice"
                value={$username()}
                onInput={(e: InputEvent) => $username.set((e.target as HTMLInputElement).value)}
                data-testid="username-input"
                autoFocus
                autocomplete="username"
              />
            </div>

            <div class="field-group">
              <label class="field-label" for="password">
                Password
              </label>
              <input
                id="password"
                class="field-input"
                type="password"
                placeholder="anything works"
                value={$password()}
                onInput={(e: InputEvent) => $password.set((e.target as HTMLInputElement).value)}
                data-testid="password-input"
                autocomplete="current-password"
              />
            </div>

            <div class="form-actions">
              <button type="submit" class="btn btn-primary" disabled={() => !isValid() || login.pending()} data-testid="login-submit">
                {() => (login.pending() ? 'Signing in\u2026' : 'Sign in')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
