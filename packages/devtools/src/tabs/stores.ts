// stores.ts — stores tab: live log of signal and store write events

const MAX_ENTRIES = 100;

interface WriteEntry {
  kind: 'signal' | 'store';
  path?: string; // store writes only
  value: unknown;
  time: number;
}

const entries: WriteEntry[] = [];
let listEl: HTMLElement | null = null;
let emptyEl: HTMLElement | null = null;
let countEl: HTMLElement | null = null;
let totalWrites = 0;

function formatValue(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    if (s === undefined) return String(v);
    return s.length > 60 ? s.slice(0, 57) + '...' : s;
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

function createEntry(entry: WriteEntry): HTMLElement {
  const el = document.createElement('div');
  el.className = '__sdt-entry';

  const label = document.createElement('span');
  label.className = '__sdt-entry-label';
  label.textContent = entry.kind === 'store' ? `store: ${entry.path}` : 'signal';

  const value = document.createElement('span');
  value.className = '__sdt-entry-value';
  value.textContent = formatValue(entry.value);
  value.title = formatValue(entry.value);

  const time = document.createElement('span');
  time.className = '__sdt-entry-time';
  time.textContent = formatTime(entry.time);

  el.appendChild(label);
  el.appendChild(value);
  el.appendChild(time);
  return el;
}

function push(entry: WriteEntry): void {
  totalWrites++;
  if (entries.length >= MAX_ENTRIES) entries.shift();
  entries.push(entry);

  if (countEl) countEl.textContent = `${totalWrites} total writes`;

  if (listEl) {
    if (emptyEl) emptyEl.style.display = 'none';
    const entryEl = createEntry(entry);
    listEl.insertBefore(entryEl, listEl.firstChild);
    while (listEl.childElementCount > MAX_ENTRIES) {
      listEl.lastElementChild?.remove();
    }
  }
}

export function addSignalEntry(value: unknown): void {
  push({ kind: 'signal', value, time: Date.now() });
}

export function addStoreEntry(path: string, value: unknown): void {
  push({ kind: 'store', path, value, time: Date.now() });
}

export function buildStoresTab(container: HTMLElement): void {
  container.innerHTML = '';

  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px';

  countEl = document.createElement('span');
  countEl.style.cssText = 'font-size:11px;color:#64748b';
  countEl.textContent = `${totalWrites} total writes`;

  const clearBtn = document.createElement('button');
  clearBtn.className = '__sdt-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    entries.length = 0;
    totalWrites = 0;
    if (countEl) countEl.textContent = '0 total writes';
    if (listEl) listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
  });

  headerRow.appendChild(countEl);
  headerRow.appendChild(clearBtn);
  container.appendChild(headerRow);

  listEl = document.createElement('div');
  listEl.style.cssText = 'display:flex;flex-direction:column;gap:4px';

  emptyEl = document.createElement('div');
  emptyEl.className = '__sdt-empty';
  emptyEl.textContent = 'No writes yet. Reactive state changes will appear here.';

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

export function clearStoresTabRef(): void {
  listEl = null;
  emptyEl = null;
  countEl = null;
}
