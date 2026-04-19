/// <reference types="vite/client" />
// Login page — route: /login
//
// Teaching points:
//   - Plain form + action pattern (no special framework form API)
//   - signal() for form state and pending/error state
//   - computed() for validation
//   - Post-login redirect: read ?redirect= from query, navigate there on success
//   - The auth guard in app.tsx sets ?redirect= before sending here

import type { JSXElement } from '@stewie-js/core';
import { signal, computed, Show } from '@stewie-js/core';
import { useRouter, useQuery } from '@stewie-js/router';
import { AppShell } from '../components/AppShell.js';
import { login } from '../actions/auth.js';

export function LoginPage(): JSXElement {
  const router = useRouter();
  const query = useQuery<{ redirect?: string }>();

  const $username = signal('');
  const $password = signal('');
  const $submitting = signal(false);
  const $error = signal('');

  const isValid = computed(() => $username().trim().length > 0 && $password().length > 0);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!isValid()) return;

    $submitting.set(true);
    $error.set('');
    try {
      login($username(), $password());
      // Navigate to the originally-requested URL, or the dashboard.
      const redirectTo = query.redirect ?? '/';
      await router.navigate(redirectTo);
    } catch (err) {
      $error.set(err instanceof Error ? err.message : 'Login failed');
      $submitting.set(false);
    }
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
            <Show when={() => $error() !== ''}>
              {() => (
                <p class="form-error" role="alert" data-testid="login-error">
                  {$error()}
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
              <button type="submit" class="btn btn-primary" disabled={() => !isValid() || $submitting()} data-testid="login-submit">
                {() => ($submitting() ? 'Signing in…' : 'Sign in')}
              </button>
            </div>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
