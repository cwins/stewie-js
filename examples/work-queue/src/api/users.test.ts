import { beforeEach, describe, it, expect } from 'vitest';
import { _resetToSeed } from '../data/mocks/repo.js';
import { _setLatencyForTests, _resetLatency, ApiError } from './client.js';
import { getUser } from './users.js';
import type { Viewer } from '../data/types.js';

const alice: Viewer = { id: 'user_alice', role: 'admin' };
const bob: Viewer = { id: 'user_bob', role: 'member' };

beforeEach(() => {
  _resetToSeed();
  _setLatencyForTests(0);
  return () => _resetLatency();
});

describe('getUser', () => {
  it('returns a self view (full record) when the viewer is the target', async () => {
    const view = await getUser(alice, 'user_alice');
    expect(view.view).toBe('self');
    if (view.view !== 'self') return; // type narrow
    expect(view.email).toBe('alice@example.com');
    expect(view.timezone).toBe('America/Los_Angeles');
    expect(view.role).toBe('admin');
    expect(view.createdAt).toBeDefined();
  });

  it('returns a public view (limited fields) when the viewer is someone else', async () => {
    const view = await getUser(bob, 'user_alice');
    expect(view.view).toBe('public');
    // Public fields present
    expect(view.id).toBe('user_alice');
    expect(view.username).toBe('alice');
    expect(view.displayName).toBe('Alice Chen');
    expect(view.bio).toContain('Platform engineer');
    expect(view.avatarColor).toBeDefined();
    // Sensitive fields absent — TypeScript would also reject these on the
    // public arm, but verify at runtime that nothing leaked through.
    expect('email' in view).toBe(false);
    expect('timezone' in view).toBe(false);
    expect('role' in view).toBe(false);
    expect('createdAt' in view).toBe(false);
  });

  it('throws ApiError(404) when the target does not exist', async () => {
    await expect(getUser(alice, 'user_ghost')).rejects.toBeInstanceOf(ApiError);
    try {
      await getUser(alice, 'user_ghost');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(404);
    }
  });

  it('treats admin viewers as non-self when viewing other users (no privilege escalation in v1)', async () => {
    // Alice is an admin; viewing bob still returns a public view.
    // Role-based escalation (admins see more) is intentionally not implemented
    // in v1 — the only axis today is self-vs-other. Add this distinction
    // only when a concrete use case demands it.
    const view = await getUser(alice, 'user_bob');
    expect(view.view).toBe('public');
  });
});
