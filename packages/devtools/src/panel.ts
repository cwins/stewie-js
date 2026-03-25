// panel.ts — the floating devtools panel

import { buildRendersTab, addRenderEntry, clearRendersTabRef } from './tabs/renders.js'
import { buildStoresTab, addSignalEntry, clearStoresTabRef } from './tabs/stores.js'
import { buildRoutesTab, clearRoutesTabRef, onNavigation } from './tabs/routes.js'
import type { DevEffectMeta } from '@stewie-js/core'

type TabId = 'renders' | 'stores' | 'routes'

let panelEl: HTMLElement | null = null
let toggleBtn: HTMLElement | null = null
let visible = false
let activeTab: TabId = 'renders'

const panes: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>
const tabBtns: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>

function switchTab(tab: TabId): void {
  activeTab = tab
  ;(Object.keys(panes) as TabId[]).forEach((id) => {
    panes[id].classList.toggle('__sdt-visible', id === tab)
    tabBtns[id].classList.toggle('__sdt-active', id === tab)
  })
}

export function createPanel(): HTMLElement {
  const root = document.createElement('div')
  root.className = '__sdt-root'
  root.setAttribute('data-testid', '__stewie-devtools__')

  // ── Toggle button ──────────────────────────────────────────────────────────
  toggleBtn = document.createElement('button')
  toggleBtn.className = '__sdt-toggle'
  toggleBtn.title = 'Toggle Stewie DevTools (Alt+D)'
  toggleBtn.textContent = 'S'
  toggleBtn.addEventListener('click', togglePanel)
  root.appendChild(toggleBtn)

  // ── Panel ──────────────────────────────────────────────────────────────────
  panelEl = document.createElement('div')
  panelEl.className = '__sdt-panel'
  panelEl.style.display = 'none'

  // Header
  const header = document.createElement('div')
  header.className = '__sdt-header'
  const title = document.createElement('span')
  title.className = '__sdt-title'
  title.textContent = '⚡ Stewie DevTools'
  header.appendChild(title)
  panelEl.appendChild(header)

  // Tabs
  const tabBar = document.createElement('div')
  tabBar.className = '__sdt-tabs'
  ;(['renders', 'stores', 'routes'] as TabId[]).forEach((id) => {
    const btn = document.createElement('button')
    btn.className = `__sdt-tab${id === activeTab ? ' __sdt-active' : ''}`
    btn.textContent = id.charAt(0).toUpperCase() + id.slice(1)
    btn.addEventListener('click', () => switchTab(id))
    tabBtns[id] = btn
    tabBar.appendChild(btn)
  })
  panelEl.appendChild(tabBar)

  // Content
  const content = document.createElement('div')
  content.className = '__sdt-content'
  ;(['renders', 'stores', 'routes'] as TabId[]).forEach((id) => {
    const pane = document.createElement('div')
    pane.className = `__sdt-pane${id === activeTab ? ' __sdt-visible' : ''}`
    panes[id] = pane
    content.appendChild(pane)
  })
  panelEl.appendChild(content)
  root.appendChild(panelEl)

  // Build initial tab content
  buildRendersTab(panes.renders)
  buildStoresTab(panes.stores)
  buildRoutesTab(panes.routes)

  return root
}

export function togglePanel(): void {
  visible ? hidePanel() : showPanel()
}

export function showPanel(): void {
  visible = true
  if (panelEl) panelEl.style.display = 'flex'
}

export function hidePanel(): void {
  visible = false
  if (panelEl) panelEl.style.display = 'none'
}

export function isVisible(): boolean {
  return visible
}

// Called by hooks.ts when an effect re-runs
export function notifyEffectRun(meta: DevEffectMeta | undefined): void {
  addRenderEntry(meta)
}

// Called by hooks.ts when a signal is written
export function notifySignalWrite(value: unknown): void {
  addSignalEntry(value)
}

// Called by routes tab when navigation happens
export { onNavigation }

export function destroyPanel(): void {
  clearRendersTabRef()
  clearStoresTabRef()
  clearRoutesTabRef()
  panelEl = null
  toggleBtn = null
}
