// styles.ts — injects devtools CSS into the document head

export function injectStyles(): void {
  const style = document.createElement('style')
  style.textContent = `
/* Container */
.__sdt-root { all: initial; font-family: system-ui, sans-serif; }

/* Toggle button — fixed bottom-right */
.__sdt-toggle {
  position: fixed; bottom: 16px; right: 16px; z-index: 999998;
  width: 40px; height: 40px; border-radius: 50%;
  background: #0ea5e9; border: none; cursor: pointer;
  color: white; font-size: 16px; font-weight: bold;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.__sdt-toggle:hover { background: #38bdf8; }

/* Panel */
.__sdt-panel {
  position: fixed; bottom: 68px; right: 16px; z-index: 999997;
  width: 400px; height: 480px;
  background: #0f172a; border: 1px solid #1e3a5f;
  border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  display: flex; flex-direction: column; overflow: hidden;
  color: #e2e8f0; font-size: 13px;
}

/* Header */
.__sdt-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: #0d1b2e;
  border-bottom: 1px solid #1e3a5f; flex-shrink: 0;
}
.__sdt-title { font-weight: 600; color: #38bdf8; font-size: 13px; }

/* Tabs */
.__sdt-tabs {
  display: flex; gap: 2px; padding: 8px 10px;
  background: #0d1b2e; border-bottom: 1px solid #1e3a5f; flex-shrink: 0;
}
.__sdt-tab {
  padding: 4px 12px; border-radius: 4px; border: none;
  background: transparent; color: #94a3b8; cursor: pointer;
  font-size: 12px; font-family: system-ui, sans-serif;
  transition: all 0.1s;
}
.__sdt-tab:hover { background: #1e3a5f; color: #e2e8f0; }
.__sdt-tab.__sdt-active { background: #1e3a5f; color: #38bdf8; }

/* Content area */
.__sdt-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.__sdt-pane { flex: 1; overflow-y: auto; padding: 10px 14px; display: none; }
.__sdt-pane.__sdt-visible { display: flex; flex-direction: column; gap: 4px; }

/* Log entries */
.__sdt-entry {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 4px 8px; border-radius: 4px; background: #1e293b;
  font-size: 12px; gap: 8px;
}
.__sdt-entry-label { color: #e2e8f0; font-family: monospace; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.__sdt-entry-time { color: #64748b; font-size: 11px; flex-shrink: 0; }
.__sdt-entry-value { color: #94a3b8; font-family: monospace; font-size: 11px; flex-shrink: 0; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Toggle row */
.__sdt-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px; background: #1e293b; border-radius: 4px; margin-bottom: 6px;
  font-size: 12px; color: #94a3b8;
}
.__sdt-switch {
  width: 32px; height: 18px; border-radius: 9px;
  background: #334155; border: none; cursor: pointer; position: relative;
  transition: background 0.2s; flex-shrink: 0;
}
.__sdt-switch.__sdt-on { background: #0ea5e9; }
.__sdt-switch::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%; background: white;
  transition: transform 0.2s;
}
.__sdt-switch.__sdt-on::after { transform: translateX(14px); }

/* Route fields */
.__sdt-field { margin-bottom: 8px; }
.__sdt-field-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
.__sdt-field-value { color: #e2e8f0; font-family: monospace; font-size: 12px; word-break: break-all; }

/* Empty state */
.__sdt-empty { color: #475569; font-size: 12px; text-align: center; padding: 24px 0; }

/* Clear button */
.__sdt-clear {
  padding: 3px 8px; border-radius: 4px; border: 1px solid #334155;
  background: transparent; color: #64748b; cursor: pointer; font-size: 11px;
  font-family: system-ui, sans-serif;
}
.__sdt-clear:hover { border-color: #475569; color: #94a3b8; }

/* Flash animation (for highlight overlay) */
@keyframes __sdt-flash {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
`
  document.head.appendChild(style)
}
