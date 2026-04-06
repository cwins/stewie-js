// serializer.ts — shared HTML serialization utilities
//
// Single source of truth consumed by both renderer.ts (renderToString) and
// stream.ts (renderToStream). Having one implementation ensures both renderers
// produce byte-identical attribute output and anchor comment semantics, which
// is required for the HydrationCursor to claim SSR nodes correctly.

// ---------------------------------------------------------------------------
// Void elements — self-closing in HTML
// ---------------------------------------------------------------------------

export const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

// ---------------------------------------------------------------------------
// HTML entity escaping
// ---------------------------------------------------------------------------

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Style object → CSS string
// Converts camelCase keys to kebab-case: fontSize → font-size
// ---------------------------------------------------------------------------

export function styleObjectToString(style: Record<string, string | number>): string {
  return Object.entries(style)
    .map(([key, value]) => {
      const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      return `${kebab}: ${value}`;
    })
    .join('; ');
}

// ---------------------------------------------------------------------------
// Attribute serialization
// ---------------------------------------------------------------------------

export function serializeAttrs(props: Record<string, unknown>): string {
  let out = '';
  for (const [key, rawValue] of Object.entries(props)) {
    // Skip internal/non-HTML props
    if (key === 'children' || key === 'key' || key === 'ref') continue;
    // Skip event handlers (on* pattern)
    if (/^on[A-Z]/.test(key)) continue;

    // Resolve reactive (function) values
    let value = typeof rawValue === 'function' ? (rawValue as () => unknown)() : rawValue;

    // Map JSX prop names to HTML attribute names
    const attrName = key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key;

    if (value === null || value === undefined || value === false) continue;

    if (value === true) {
      // Boolean presence attribute: <input disabled />
      out += ` ${attrName}`;
      continue;
    }

    if (attrName === 'style' && typeof value === 'object') {
      value = styleObjectToString(value as Record<string, string | number>);
    }

    out += ` ${attrName}="${escapeHtml(String(value))}"`;
  }
  return out;
}
