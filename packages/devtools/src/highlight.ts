// highlight.ts — flash overlay for DOM elements that just re-rendered

let highlightEnabled = true

export function setHighlightEnabled(v: boolean): void {
  highlightEnabled = v
}

export function isHighlightEnabled(): boolean {
  return highlightEnabled
}

export function flashElement(el: Element): void {
  if (!highlightEnabled) return
  if (!document.body.contains(el)) return

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return

  const flash = document.createElement('div')
  flash.style.cssText = [
    'position:fixed',
    `left:${rect.left}px`,
    `top:${rect.top}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'background:rgba(56,189,248,0.25)',
    'outline:2px solid rgba(56,189,248,0.8)',
    'outline-offset:-1px',
    'pointer-events:none',
    'z-index:999999',
    'border-radius:2px',
    'animation:__sdt-flash 600ms ease-out forwards',
  ].join(';')
  document.body.appendChild(flash)
  flash.addEventListener('animationend', () => flash.remove())
}
