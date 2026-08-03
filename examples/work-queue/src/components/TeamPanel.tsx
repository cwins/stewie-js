/// <reference types="vite/client" />
// TeamPanel — a self-fetching bit of persistent chrome.
//
// Lives in the app shell and shows the team roster on every route. It fetches
// its own data via useResource(fetchUsers) rather than depending on route
// loaders — the natural design for a reusable component in persistent chrome.
//
// This is also the canonical-app testbed for the loader/resource dedup
// question (ROADMAP "SSR + Hydration Correctness"): on routes whose loader
// ALSO lists users (task detail, project detail), the loader and this panel
// both hit listUsers — the double-fetch the deferred dedup work would collapse.

import type { JSXElement, Resource } from '@stewie-js/core';
import { reactiveScope, useResource, Suspense, For } from '@stewie-js/core';
import { fetchUsers } from '../data/resources.js';
import type { UserPublic } from '../data/types.js';

function TeamRoster(): JSXElement {
  // Created in an outer scope so the Suspense retry (after read() throws) reuses
  // the same instance instead of spawning a fresh fetch on every retry.
  let res!: Resource<UserPublic[]>;
  reactiveScope(() => {
    res = useResource(fetchUsers, () => undefined);
  });

  function List(): JSXElement {
    const users = res.read();
    return (
      <ul class="team-panel-list" data-testid="team-panel-list">
        <For each={users} by={(u) => u.id}>
          {(user) => (
            <li class="team-panel-member" title={() => user().displayName}>
              <span class="team-panel-avatar" style={() => `background-color: ${user().avatarColor}`} aria-hidden="true">
                {() => user().displayName.charAt(0).toUpperCase()}
              </span>
              <span class="team-panel-name">{() => user().displayName}</span>
            </li>
          )}
        </For>
      </ul>
    );
  }

  return <List />;
}

export function TeamPanel(): JSXElement {
  return (
    <aside class="team-panel" data-testid="team-panel">
      <h2 class="team-panel-title">Team</h2>
      <Suspense fallback={<p class="team-panel-loading">Loading team…</p>}>
        <TeamRoster />
      </Suspense>
    </aside>
  );
}
