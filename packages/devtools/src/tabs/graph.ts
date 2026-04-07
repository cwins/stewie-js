// graph.ts — signal graph tab: live dependency tree of reactive nodes

interface GraphNode {
  id: number;
  kind: 'signal' | 'computed' | 'effect';
  label?: string;
  deps: number[]; // IDs of nodes this node depends on
  disposed: boolean;
}

const nodes = new Map<number, GraphNode>();
let _containerEl: HTMLElement | null = null;

// ---------------------------------------------------------------------------
// Public hooks — called from panel.ts devHook handlers
// ---------------------------------------------------------------------------

export function onGraphNodeCreate(id: number, kind: 'signal' | 'computed' | 'effect', label?: string): void {
  nodes.set(id, { id, kind, label, deps: [], disposed: false });
  _renderIfVisible();
}

export function onGraphNodeDispose(id: number): void {
  const node = nodes.get(id);
  if (node) {
    node.disposed = true;
    // Prune disposed leaves after a short delay so the user can see them go
    setTimeout(() => {
      nodes.delete(id);
      _renderIfVisible();
    }, 1500);
  }
  _renderIfVisible();
}

export function onGraphDepsUpdate(id: number, deps: number[]): void {
  const node = nodes.get(id);
  if (node) {
    node.deps = deps;
    _renderIfVisible();
  }
}

// ---------------------------------------------------------------------------
// Build tab DOM
// ---------------------------------------------------------------------------

export function buildGraphTab(container: HTMLElement): void {
  _containerEl = container;
  _render(container);
}

export function clearGraphTabRef(): void {
  _containerEl = null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function _renderIfVisible(): void {
  if (_containerEl) _render(_containerEl);
}

function _render(container: HTMLElement): void {
  container.innerHTML = '';

  // Header row
  const headerRow = document.createElement('div');
  headerRow.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-shrink:0';

  const info = document.createElement('span');
  info.style.cssText = 'font-size:11px;color:#64748b';
  const alive = [...nodes.values()].filter((n) => !n.disposed).length;
  info.textContent = `${alive} active node${alive !== 1 ? 's' : ''}`;

  const clearBtn = document.createElement('button');
  clearBtn.className = '__sdt-clear';
  clearBtn.textContent = 'Clear disposed';
  clearBtn.addEventListener('click', () => {
    for (const [id, node] of nodes) {
      if (node.disposed) nodes.delete(id);
    }
    _renderIfVisible();
  });

  headerRow.appendChild(info);
  headerRow.appendChild(clearBtn);
  container.appendChild(headerRow);

  if (nodes.size === 0) {
    const empty = document.createElement('div');
    empty.className = '__sdt-empty';
    empty.textContent = 'No reactive nodes yet. Create signals, computed values, or effects to see the graph.';
    container.appendChild(empty);
    return;
  }

  // Render: signals first, then computed, then effects
  const order: Array<'signal' | 'computed' | 'effect'> = ['signal', 'computed', 'effect'];
  for (const kind of order) {
    const group = [...nodes.values()].filter((n) => n.kind === kind);
    if (group.length === 0) continue;

    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:8px';

    const sectionLabel = document.createElement('div');
    sectionLabel.style.cssText =
      'font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:4px;font-weight:600';
    sectionLabel.textContent = kind === 'signal' ? 'Signals' : kind === 'computed' ? 'Computed' : 'Effects';
    section.appendChild(sectionLabel);

    for (const node of group) {
      section.appendChild(_createNodeEl(node));
    }

    container.appendChild(section);
  }
}

const KIND_COLOR: Record<string, string> = {
  signal: '#0ea5e9',
  computed: '#a78bfa',
  effect: '#34d399'
};

const KIND_PREFIX: Record<string, string> = {
  signal: 'sig',
  computed: 'cmp',
  effect: 'eff'
};

function _nodeName(node: GraphNode): string {
  const prefix = KIND_PREFIX[node.kind] ?? node.kind;
  if (node.label) return `${prefix}(${node.label})`;
  return `${prefix}#${node.id}`;
}

function _createNodeEl(node: GraphNode): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `
    padding:5px 8px; border-radius:4px; background:#1e293b;
    font-size:12px; font-family:monospace; margin-bottom:3px;
    opacity:${node.disposed ? '0.4' : '1'};
    border-left:2px solid ${KIND_COLOR[node.kind] ?? '#475569'};
  `.replace(/\n\s*/g, '');

  const nameRow = document.createElement('div');
  nameRow.style.cssText = 'display:flex;align-items:baseline;gap:6px';

  const name = document.createElement('span');
  name.style.color = KIND_COLOR[node.kind] ?? '#e2e8f0';
  name.textContent = _nodeName(node);

  nameRow.appendChild(name);

  if (node.disposed) {
    const badge = document.createElement('span');
    badge.style.cssText = 'font-size:10px;color:#475569';
    badge.textContent = '(disposed)';
    nameRow.appendChild(badge);
  }

  el.appendChild(nameRow);

  if (node.deps.length > 0) {
    const depsRow = document.createElement('div');
    depsRow.style.cssText = 'margin-top:2px;font-size:11px;color:#64748b;padding-left:8px';

    const depNames = node.deps.map((depId) => {
      const dep = nodes.get(depId);
      return dep ? _nodeName(dep) : `#${depId}`;
    });
    depsRow.textContent = `← ${depNames.join(', ')}`;
    el.appendChild(depsRow);
  }

  return el;
}
