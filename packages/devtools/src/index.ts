// @stewie-js/devtools — browser overlay devtools panel

export const version = '0.1.0'

import { injectStyles } from './styles.js'
import { createPanel, togglePanel, onNavigation, destroyPanel } from './panel.js'
import { installHooks, uninstallHooks } from './hooks.js'

let initialized = false
let rootEl: HTMLElement | null = null
let keyHandler: ((e: KeyboardEvent) => void) | null = null
let popstateHandler: (() => void) | null = null

export function initDevtools(): void {
  if (initialized) return
  initialized = true

  injectStyles()

  rootEl = createPanel()
  document.body.appendChild(rootEl)

  installHooks()

  // Alt+D to toggle panel
  keyHandler = (e: KeyboardEvent) => {
    if (e.altKey && e.key === 'd') {
      e.preventDefault()
      togglePanel()
    }
  }
  document.addEventListener('keydown', keyHandler)

  // Track navigation
  popstateHandler = () => onNavigation()
  window.addEventListener('popstate', popstateHandler)
}

export function destroyDevtools(): void {
  if (!initialized) return
  initialized = false

  uninstallHooks()

  if (rootEl) {
    document.body.removeChild(rootEl)
    rootEl = null
  }
  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler)
    keyHandler = null
  }
  if (popstateHandler) {
    window.removeEventListener('popstate', popstateHandler)
    popstateHandler = null
  }
  destroyPanel()
}
