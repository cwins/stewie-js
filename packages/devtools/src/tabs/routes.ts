// routes.ts — routes tab: current URL, params, query, navigation history

const MAX_HISTORY = 20;

interface HistoryEntry {
  pathname: string;
  time: number;
}

const navHistory: HistoryEntry[] = [{ pathname: location.pathname, time: Date.now() }];
let containerEl: HTMLElement | null = null;

function parseQuery(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  new URLSearchParams(search).forEach((v, k) => {
    params[k] = v;
  });
  return params;
}

function buildField(label: string, value: string, mono = true): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = '__sdt-field';
  const lbl = document.createElement('div');
  lbl.className = '__sdt-field-label';
  lbl.textContent = label;
  const val = document.createElement('div');
  val.className = '__sdt-field-value';
  if (!mono) val.style.fontFamily = 'system-ui, sans-serif';
  val.textContent = value || '—';
  wrap.appendChild(lbl);
  wrap.appendChild(val);
  return wrap;
}

function renderRouteContent(container: HTMLElement): void {
  container.innerHTML = '';

  const query = parseQuery(location.search);
  const queryStr = Object.keys(query).length > 0 ? JSON.stringify(query, null, 2).replace(/\n/g, ' ') : '';

  // Try to read router location params if the router registered itself
  const win = window as unknown as Record<string, unknown>;
  const routerParams = win.__STEWIE_ROUTER__
    ? (win.__STEWIE_ROUTER__ as { location?: { params?: Record<string, string> } }).location?.params
    : undefined;
  const paramsStr = routerParams && Object.keys(routerParams).length > 0 ? JSON.stringify(routerParams) : '';

  container.appendChild(buildField('Pathname', location.pathname));
  if (paramsStr) container.appendChild(buildField('Params', paramsStr));
  if (queryStr) container.appendChild(buildField('Query', queryStr));
  if (location.hash) container.appendChild(buildField('Hash', location.hash));

  // Navigation history
  const histLabel = document.createElement('div');
  histLabel.className = '__sdt-field-label';
  histLabel.style.marginTop = '12px';
  histLabel.textContent = `Navigation history (${navHistory.length})`;
  container.appendChild(histLabel);

  const histList = document.createElement('div');
  histList.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-top:4px';
  navHistory
    .slice()
    .reverse()
    .forEach((entry, i) => {
      const row = document.createElement('div');
      row.className = '__sdt-entry';
      const path = document.createElement('span');
      path.className = '__sdt-entry-label';
      path.textContent = (i === 0 ? '▶ ' : '') + entry.pathname;
      if (i === 0) path.style.color = '#38bdf8';
      const time = document.createElement('span');
      time.className = '__sdt-entry-time';
      const delta = Date.now() - entry.time;
      time.textContent = delta < 1000 ? 'just now' : `${Math.floor(delta / 1000)}s ago`;
      row.appendChild(path);
      row.appendChild(time);
      histList.appendChild(row);
    });
  container.appendChild(histList);
}

export function onNavigation(): void {
  const last = navHistory[navHistory.length - 1];
  if (last?.pathname !== location.pathname) {
    if (navHistory.length >= MAX_HISTORY) navHistory.shift();
    navHistory.push({ pathname: location.pathname, time: Date.now() });
  }
  if (containerEl) renderRouteContent(containerEl);
}

export function buildRoutesTab(container: HTMLElement): void {
  containerEl = container;
  renderRouteContent(container);
}

export function clearRoutesTabRef(): void {
  containerEl = null;
}
