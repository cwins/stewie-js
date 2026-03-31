// @stewie-js/devtools — browser overlay devtools panel

export const version = '0.4.0'

import { injectStyles } from './styles.js'
import { createPanel, togglePanel, onNavigation, destroyPanel } from './panel.js'
import { installHooks, uninstallHooks } from './hooks.js'

let initialized = false
let rootEl: HTMLElement | null = null
let keyHandler: ((e: KeyboardEvent) => void) | null = null
let popstateHandler: (() => void) | null = null
let navigateSuccessHandler: (() => void) | null = null

// Patched history methods — kept so we can restore them on destroyDevtools
let _origPushState: typeof history.pushState | null = null
let _origReplaceState: typeof history.replaceState | null = null

function hasNavigationApi(): boolean {
  return typeof (globalThis as Record<string, unknown>)['navigation'] !== 'undefined'
}

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

  // Track navigation — strategy depends on what the browser supports:
  //   Navigation API (Chrome 102+): listen to 'navigatesuccess' which fires
  //     after the navigation commits and window.location is updated.
  //   History API fallback: monkey-patch pushState/replaceState, which the
  //     router calls after every programmatic navigation.
  //   Both paths: also keep popstate for browser back/forward.
  if (hasNavigationApi()) {
    navigateSuccessHandler = () => onNavigation()
    ;(globalThis as unknown as Record<string, EventTarget>)['navigation']
      .addEventListener('navigatesuccess', navigateSuccessHandler)
  } else {
    // Patch pushState
    _origPushState = history.pushState.bind(history)
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      _origPushState!(...args)
      onNavigation()
    }
    // Patch replaceState
    _origReplaceState = history.replaceState.bind(history)
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      _origReplaceState!(...args)
      onNavigation()
    }
  }

  // Always keep popstate for browser back/forward
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
  if (navigateSuccessHandler) {
    ;(globalThis as unknown as Record<string, EventTarget>)['navigation']
      .removeEventListener('navigatesuccess', navigateSuccessHandler)
    navigateSuccessHandler = null
  }
  if (_origPushState) {
    history.pushState = _origPushState
    _origPushState = null
  }
  if (_origReplaceState) {
    history.replaceState = _origReplaceState
    _origReplaceState = null
  }
  if (popstateHandler) {
    window.removeEventListener('popstate', popstateHandler)
    popstateHandler = null
  }
  destroyPanel()
}
