// renders.ts — renders tab content: highlight toggle + effect run log

import { flashElement, setHighlightEnabled, isHighlightEnabled } from '../highlight.js';
import type { DevEffectMeta } from '@stewie-js/core';

const MAX_ENTRIES = 100;

interface RenderEntry {
  label: string;
  element?: Element;
  time: number;
}

const entries: RenderEntry[] = [];
let listEl: HTMLElement | null = null;
let emptyEl: HTMLElement | null = null;

function formatLabel(meta: DevEffectMeta | undefined): string {
  if (!meta) return 'effect';
  if (meta.element) {
    const tag = meta.element.tagName.toLowerCase();
    const id = meta.element.id ? `#${meta.element.id}` : '';
    const cls = meta.element.classList.length > 0 ? `.${meta.element.classList[0]}` : '';
    return `<${tag}${id || cls}>.${meta.attr ?? '?'}`;
  }
  return meta.type;
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
  }

  const label = document.createElement('span');
  label.className = '__sdt-entry-label';
  label.textContent = entry.label;

  const time = document.createElement('span');
  time.className = '__sdt-entry-time';
  time.textContent = formatTime(entry.time);

  el.appendChild(label);
  el.appendChild(time);
  return el;
}

export function addRenderEntry(meta: DevEffectMeta | undefined): void {
  if (!meta) return;
  // 'children' is the Router's top-level navigation effect — too noisy, skip
  if (meta.type === 'children') return;

  const entry: RenderEntry = {
    label: formatLabel(meta),
    element: meta.element,
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

  // Flash the element only for prop effects (we have a concrete DOM node)
  if (meta.element) {
    flashElement(meta.element);
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
