// scheduler.ts — coalesces devtools DOM work into one flush per frame.
//
// Every core dev hook (node create/dispose, deps update, signal write, effect
// run) used to drive DOM work synchronously, inside the effect that triggered
// it. A client-side navigation disposes every reactive node in the outgoing
// subtree and creates every node in the incoming one, so that produced
// O(nodes) full pane rebuilds per navigation — and since each rebuild
// reconstructs every node element, O(nodes²) DOM work overall.
//
// Panes now register a renderer and mark themselves dirty. A dirty pane is
// rendered at most once per frame, and only while it is actually on screen:
// a collapsed panel or an inactive tab does no DOM work at all. State keeps
// accumulating either way, so a pane that becomes visible renders current
// state immediately.

export type TabId = 'renders' | 'stores' | 'routes' | 'graph';

const renderers = new Map<TabId, () => void>();
const dirty = new Set<TabId>();

let panelVisible = false;
let activeTab: TabId = 'renders';
let frame: number | null = null;

/** rAF when available; setTimeout keeps non-browser test envs working. */
function requestFrame(fn: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn) as unknown as number;
  return setTimeout(fn, 0) as unknown as number;
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else clearTimeout(handle);
}

/** True when `tab`'s DOM is actually on screen. */
export function isPaneLive(tab: TabId): boolean {
  return panelVisible && activeTab === tab;
}

export function registerRenderer(tab: TabId, render: () => void): void {
  renderers.set(tab, render);
}

export function unregisterRenderer(tab: TabId): void {
  renderers.delete(tab);
  dirty.delete(tab);
}

/**
 * Record that `tab`'s data changed. Cheap and safe to call from a hot path —
 * it never touches the DOM. Rendering happens on the next frame, and only if
 * the pane is on screen.
 */
export function markDirty(tab: TabId): void {
  dirty.add(tab);
  if (!isPaneLive(tab)) return; // stays dirty; renders when it becomes live
  if (frame !== null) return;
  frame = requestFrame(() => {
    frame = null;
    flushNow();
  });
}

/** Render every dirty pane that is currently on screen. */
export function flushNow(): void {
  if (frame !== null) {
    cancelFrame(frame);
    frame = null;
  }
  // Snapshot deliberately: a renderer may mark another pane dirty, and we
  // don't want that landing in this same pass.
  // eslint-disable-next-line unicorn/no-useless-spread
  for (const tab of [...dirty]) {
    if (!isPaneLive(tab)) continue;
    dirty.delete(tab);
    renderers.get(tab)?.();
  }
}

/** Render `tab` now if it has pending changes. Used when a pane becomes live. */
function flushTab(tab: TabId): void {
  if (!dirty.has(tab) || !isPaneLive(tab)) return;
  dirty.delete(tab);
  renderers.get(tab)?.();
}

export function setPanelVisible(visible: boolean): void {
  panelVisible = visible;
  if (visible) flushTab(activeTab);
}

export function setActiveTab(tab: TabId): void {
  activeTab = tab;
  flushTab(tab);
}

/** Test/teardown helper — drops all registrations and pending work. */
export function resetScheduler(): void {
  if (frame !== null) {
    cancelFrame(frame);
    frame = null;
  }
  renderers.clear();
  dirty.clear();
  panelVisible = false;
  activeTab = 'renders';
}
