// panel.ts — the floating devtools panel

import { buildRendersTab, addRenderEntry, clearRendersTabRef } from './tabs/renders.js';
import { buildStoresTab, addSignalEntry, addStoreEntry, clearStoresTabRef } from './tabs/stores.js';
import { buildRoutesTab, clearRoutesTabRef, onNavigation } from './tabs/routes.js';
import {
  buildGraphTab,
  clearGraphTabRef,
  onGraphNodeCreate,
  onGraphNodeDispose,
  onGraphDepsUpdate
} from './tabs/graph.js';
import type { DevEffectMeta } from '@stewie-js/core';

export interface Trigger {
  kind: 'signal' | 'store';
  oldValue?: unknown;
  value: unknown;
  label?: string; // signal label (if set)
  path?: string; // store path
  caller?: string; // best-effort source location of the write
}

// The most recently observed reactive write — used to attribute effect re-runs
// to their triggering write in the Renders tab. Cleared after each flush of the
// microtask queue so stale attribution doesn't bleed into unrelated rerenders.
let _currentTrigger: Trigger | null = null;
let _triggerClearTimer: ReturnType<typeof setTimeout> | null = null;

export function setCurrentTrigger(t: Trigger): void {
  _currentTrigger = t;
  // Clear after the current synchronous task so future async rerenders
  // don't get falsely attributed to an old write.
  if (_triggerClearTimer !== null) clearTimeout(_triggerClearTimer);
  _triggerClearTimer = setTimeout(() => {
    _currentTrigger = null;
    _triggerClearTimer = null;
  }, 0);
}

export function getCurrentTrigger(): Trigger | null {
  return _currentTrigger;
}

type TabId = 'renders' | 'stores' | 'routes' | 'graph';

let panelEl: HTMLElement | null = null;
let toggleBtn: HTMLElement | null = null;
let visible = false;
let activeTab: TabId = 'renders';

const panes: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>;
const tabBtns: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>;

function switchTab(tab: TabId): void {
  activeTab = tab;
  (Object.keys(panes) as TabId[]).forEach((id) => {
    panes[id].classList.toggle('__sdt-visible', id === tab);
    tabBtns[id].classList.toggle('__sdt-active', id === tab);
  });
}

export function createPanel(): HTMLElement {
  const root = document.createElement('div');
  root.className = '__sdt-root';
  root.setAttribute('data-testid', '__stewie-devtools__');

  // ── Toggle button ──────────────────────────────────────────────────────────
  toggleBtn = document.createElement('button');
  toggleBtn.className = '__sdt-toggle';
  toggleBtn.title = 'Toggle Stewie DevTools (Alt+D)';
  toggleBtn.textContent = 'S';
  toggleBtn.addEventListener('click', togglePanel);
  root.appendChild(toggleBtn);

  // ── Panel ──────────────────────────────────────────────────────────────────
  panelEl = document.createElement('div');
  panelEl.className = '__sdt-panel';
  panelEl.style.display = 'none';

  // Header
  const header = document.createElement('div');
  header.className = '__sdt-header';
  const title = document.createElement('span');
  title.className = '__sdt-title';
  title.textContent = '⚡ Stewie DevTools';
  header.appendChild(title);
  panelEl.appendChild(header);

  // Tabs
  const tabBar = document.createElement('div');
  tabBar.className = '__sdt-tabs';
  (['renders', 'stores', 'routes', 'graph'] as TabId[]).forEach((id) => {
    const btn = document.createElement('button');
    btn.className = `__sdt-tab${id === activeTab ? ' __sdt-active' : ''}`;
    btn.textContent = id.charAt(0).toUpperCase() + id.slice(1);
    btn.addEventListener('click', () => switchTab(id));
    tabBtns[id] = btn;
    tabBar.appendChild(btn);
  });
  panelEl.appendChild(tabBar);

  // Content
  const content = document.createElement('div');
  content.className = '__sdt-content';
  (['renders', 'stores', 'routes', 'graph'] as TabId[]).forEach((id) => {
    const pane = document.createElement('div');
    pane.className = `__sdt-pane${id === activeTab ? ' __sdt-visible' : ''}`;
    panes[id] = pane;
    content.appendChild(pane);
  });
  panelEl.appendChild(content);
  root.appendChild(panelEl);

  // Build initial tab content
  buildRendersTab(panes.renders);
  buildStoresTab(panes.stores);
  buildRoutesTab(panes.routes);
  buildGraphTab(panes.graph);

  return root;
}

export function togglePanel(): void {
  if (visible) {
    hidePanel();
  } else {
    showPanel();
  }
}

export function showPanel(): void {
  visible = true;
  if (panelEl) panelEl.style.display = 'flex';
}

export function hidePanel(): void {
  visible = false;
  if (panelEl) panelEl.style.display = 'none';
}

export function isVisible(): boolean {
  return visible;
}

// Called by hooks.ts when an effect re-runs
export function notifyEffectRun(meta: DevEffectMeta | undefined): void {
  addRenderEntry(meta, _currentTrigger);
}

// Called by hooks.ts when a signal is written
export function notifySignalWrite(oldValue: unknown, newValue: unknown, label?: string, caller?: string): void {
  addSignalEntry(oldValue, newValue, label, caller);
}

// Called by hooks.ts when a store property is written
export function notifyStoreWrite(path: string, oldValue: unknown, newValue: unknown, caller?: string): void {
  addStoreEntry(path, oldValue, newValue, caller);
}

// Called by routes tab when navigation happens
export { onNavigation };

export function destroyPanel(): void {
  clearRendersTabRef();
  clearStoresTabRef();
  clearRoutesTabRef();
  clearGraphTabRef();
  panelEl = null;
  toggleBtn = null;
}

// Graph node lifecycle — forwarded from hooks.ts
export { onGraphNodeCreate, onGraphNodeDispose, onGraphDepsUpdate };
