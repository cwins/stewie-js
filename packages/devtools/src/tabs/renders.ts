// renders.ts — renders tab content: highlight toggle + effect run log

import { flashElement, flashAnchorParent, setHighlightEnabled, isHighlightEnabled } from '../highlight.js';
import type { DevEffectMeta } from '@stewie-js/core';
import type { Trigger } from '../panel.js';

const MAX_ENTRIES = 100;

interface RenderEntry {
  label: string;
  element?: Element;
  anchor?: Comment;
  trigger?: Trigger;
  time: number;
}

const entries: RenderEntry[] = [];
let listEl: HTMLElement | null = null;
let emptyEl: HTMLElement | null = null;

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList.length > 0 ? `.${el.classList[0]}` : '';
  return `<${tag}${id || cls}>`;
}

function formatLabel(meta: DevEffectMeta | undefined): string {
  if (!meta) return 'effect';
  const comp = meta.component ? `${meta.component} > ` : '';
  if (meta.element) {
    return `${comp}${describeElement(meta.element)}.${meta.attr ?? '?'}`;
  }
  if (meta.anchor) {
    const parent = meta.anchor.parentElement;
    if (parent) {
      return `${comp}${meta.type} in ${describeElement(parent)}`;
    }
  }
  return `${comp}${meta.type}`;
}

function formatTrigger(trigger: Trigger): string {
  if (trigger.kind === 'signal') {
    const name = trigger.label ? `signal(${trigger.label})` : 'signal';
    if (trigger.oldValue !== undefined) {
      return `${name}: ${formatValue(trigger.oldValue)} → ${formatValue(trigger.value)}`;
    }
    return `${name} = ${formatValue(trigger.value)}`;
  }
  const name = `store.${trigger.path}`;
  if (trigger.oldValue !== undefined) {
    return `${name}: ${formatValue(trigger.oldValue)} → ${formatValue(trigger.value)}`;
  }
  return `${name} = ${formatValue(trigger.value)}`;
}

function formatValue(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    if (s === undefined) return String(v);
    return s.length > 30 ? s.slice(0, 27) + '...' : s;
  } catch {
    return String(v);
  }
}

function formatTime(time: number): string {
  const delta = Date.now() - time;
  if (delta < 1000) return 'just now';
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  return `${Math.floor(delta / 60_000)}m ago`;
}

function createEntry(entry: RenderEntry): HTMLElement {
  const el = document.createElement('div');
  el.className = '__sdt-entry';
  if (entry.element) {
    el.style.cursor = 'pointer';
    el.title = 'Click to highlight element';
    el.addEventListener('click', () => flashElement(entry.element!));
  } else if (entry.anchor) {
    el.style.cursor = 'pointer';
    el.title = 'Click to highlight parent container';
    el.addEventListener('click', () => flashAnchorParent(entry.anchor!));
  }

  const labelSpan = document.createElement('span');
  labelSpan.className = '__sdt-entry-label';
  labelSpan.textContent = entry.label;

  el.appendChild(labelSpan);

  if (entry.trigger) {
    const triggerSpan = document.createElement('span');
    triggerSpan.className = '__sdt-entry-trigger';
    triggerSpan.textContent = `← ${formatTrigger(entry.trigger)}`;
    el.appendChild(triggerSpan);
  }

  const time = document.createElement('span');
  time.className = '__sdt-entry-time';
  time.textContent = formatTime(entry.time);

  el.appendChild(time);
  return el;
}

export function addRenderEntry(meta: DevEffectMeta | undefined, trigger?: Trigger | null): void {
  if (!meta) return;
  // 'children' is the Router's top-level navigation effect — too noisy, skip
  if (meta.type === 'children') return;

  const entry: RenderEntry = {
    label: formatLabel(meta),
    element: meta.element,
    anchor: meta.anchor,
    trigger: trigger ?? undefined,
    time: Date.now()
  };

  if (entries.length >= MAX_ENTRIES) entries.shift();
  entries.push(entry);

  if (listEl) {
    if (emptyEl) emptyEl.style.display = 'none';
    const entryEl = createEntry(entry);
    listEl.insertBefore(entryEl, listEl.firstChild);
    while (listEl.childElementCount > MAX_ENTRIES) {
      listEl.lastElementChild?.remove();
    }
  }

  if (meta.element) {
    flashElement(meta.element);
  } else if (meta.anchor) {
    flashAnchorParent(meta.anchor);
  }
}

export function buildRendersTab(container: HTMLElement): void {
  container.innerHTML = '';

  // Highlight toggle row
  const toggleRow = document.createElement('div');
  toggleRow.className = '__sdt-toggle-row';

  const label = document.createElement('span');
  label.textContent = 'Highlight reactive updates';

  const switchBtn = document.createElement('button');
  switchBtn.className = `__sdt-switch ${isHighlightEnabled() ? '__sdt-on' : ''}`;
  switchBtn.title = 'Toggle render highlights';
  switchBtn.addEventListener('click', () => {
    const next = !isHighlightEnabled();
    setHighlightEnabled(next);
    switchBtn.classList.toggle('__sdt-on', next);
  });

  toggleRow.appendChild(label);
  toggleRow.appendChild(switchBtn);
  container.appendChild(toggleRow);

  // Clear button row
  const clearRow = document.createElement('div');
  clearRow.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:6px';
  const clearBtn = document.createElement('button');
  clearBtn.className = '__sdt-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    entries.length = 0;
    if (listEl) listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
  });
  clearRow.appendChild(clearBtn);
  container.appendChild(clearRow);

  // Entry list
  listEl = document.createElement('div');
  listEl.style.cssText = 'display:flex;flex-direction:column;gap:4px';

  emptyEl = document.createElement('div');
  emptyEl.className = '__sdt-empty';
  emptyEl.textContent = 'No reactive updates yet. Interact with the page to see updates here.';

  if (entries.length === 0) {
    listEl.appendChild(emptyEl);
  } else {
    emptyEl.style.display = 'none';
    entries
      .slice()
      .reverse()
      .forEach((e) => listEl!.appendChild(createEntry(e)));
  }

  container.appendChild(listEl);
}

export function clearRendersTabRef(): void {
  listEl = null;
  emptyEl = null;
}
