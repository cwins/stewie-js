// highlight.ts — flash overlay for DOM elements that just re-rendered

let highlightEnabled = true;

export function setHighlightEnabled(v: boolean): void {
  highlightEnabled = v;
}

export function isHighlightEnabled(): boolean {
  return highlightEnabled;
}

export function flashAnchorParent(anchor: Comment): void {
  const parent = anchor.parentElement;
  if (!parent) return;
  flashElement(parent);
}

// Effects are per-attribute, so one element commonly has several (a `class`
// binding and a text child, say). Flashing on each would stack overlays on the
// same node for a single update. Collect per frame and flash each element once
// — which also means the rect is measured after the DOM has settled.
const pendingFlash = new Set<Element>();
let flashFrame: number | null = null;

export function flashElement(el: Element): void {
  if (!highlightEnabled) return;
  pendingFlash.add(el);
  if (flashFrame !== null) return;

  const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn: () => void) => setTimeout(fn, 0);
  flashFrame = schedule(() => {
    flashFrame = null;
    const els = [...pendingFlash];
    pendingFlash.clear();
    for (const e of els) paintFlash(e);
  }) as unknown as number;
}

/** Number of elements waiting to flash. Test-only. */
export function _pendingFlashCount(): number {
  return pendingFlash.size;
}

function paintFlash(el: Element): void {
  if (!document.body.contains(el)) return;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  const flash = document.createElement('div');
  flash.style.cssText = [
    'position:fixed',
    `left:${rect.left}px`,
    `top:${rect.top}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'background:rgba(4, 158, 163, 0.46)',
    'border:4px solid rgba(56,189,248,0.9)',
    'box-sizing:border-box',
    'pointer-events:none',
    'z-index:999999',
    'border-radius:3px',
    'animation:__sdt-flash 1000ms ease-in forwards'
  ].join(';');
  document.body.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove());
}
