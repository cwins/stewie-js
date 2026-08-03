// Canonical-app experiment: does a route loader and a self-fetching component
// resource that hit the same endpoint double-fetch?
//
// The TeamPanel in the app shell fetches the user list via
// useResource(fetchUsers). Several route loaders ALSO call listUsers. This test
// measures the actual listUsers call count per route during one SSR render, to
// produce evidence for the deferred loader/resource dedup work (ROADMAP "SSR +
// Hydration Correctness"). See the findings summary at the bottom.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderApp } from './app.js';
import { _resetToSeed } from './data/mocks/repo.js';
import { signOut } from './data/mocks/auth.js';
import { _setLatencyForTests, _resetLatency } from './api/client.js';
import * as usersApi from './api/users.js';

beforeEach(() => {
  _resetToSeed();
  signOut();
  _setLatencyForTests(0); // keep the SSR awaits instant
});

afterEach(() => {
  _resetLatency();
  vi.restoreAllMocks();
});

describe('loader/resource dedup — canonical-app measurement', () => {
  it('OVERLAP: a route whose loader lists users double-fetches with the panel', async () => {
    const spy = vi.spyOn(usersApi, 'listUsers');

    const { html } = await renderApp('/tasks/task_1');

    // The panel rendered its roster in the SSR HTML (proves the resource ran
    // and resolved server-side, not just a fallback).
    expect(html).toContain('data-testid="team-panel-list"');

    // task-detail's loader calls listUsers once; the TeamPanel resource calls
    // it again — they do NOT share a registry entry today. This is the
    // double-fetch the dedup work targets.
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('CONTROL: a route whose loader does NOT list users fetches once (panel only)', async () => {
    const spy = vi.spyOn(usersApi, 'listUsers');

    const { html } = await renderApp('/projects');

    expect(html).toContain('data-testid="team-panel-list"');
    // projects loader uses getProjects/getTaskCounts, not listUsers — so the
    // only listUsers call is the panel's. No overlap, no redundancy.
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// FINDINGS (2026-08-03)
//
// Confirmed: the double-fetch is REAL and observable. On /tasks/:id the user
// list is fetched twice in a single SSR render — once by the route loader, once
// by the TeamPanel's useResource — because loaders write the HydrationRegistry
// (_routeDataMap / __STEWIE_STATE__) while resources write the DataRegistry
// (__STEWIE_DATA__); the two never reconcile on a shared key.
//
// But note the SHAPE of the pressure: the overlap only exists because BOTH a
// loader and an independent component fetch the same endpoint. In this app that
// happens only because we deliberately added a self-fetching panel; the rest of
// the app prop-drills loader data and never doubles up. So the dedup is a real
// win for the "reusable component owns its data" pattern, but the pressure is
// modest until an app leans on that pattern widely. This matches the deferred
// decision: worth building when resource usage grows, not before. The evidence
// now exists in-repo to justify it (and to regression-test a future fix: the
// OVERLAP case should drop to 1 call once loaders and resources share a key).
// ---------------------------------------------------------------------------
