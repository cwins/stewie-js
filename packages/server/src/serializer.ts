// serializer.ts — shared HTML serialization utilities used by stream.ts.
// Both renderToStream and renderToString go through the same walker, so they
// already produce byte-identical attribute output and anchor comment semantics
// — required for the HydrationCursor to claim SSR nodes correctly.

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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Style object → CSS string
// Converts camelCase keys to kebab-case: fontSize → font-size
// ---------------------------------------------------------------------------

/**
 * Serialize a value as a JavaScript string literal that is safe to embed inside an
 * inline `<script>` element.
 *
 * `JSON.stringify` escapes quotes and backslashes but NOT `<`, so a value containing
 * `</script>` closes the script element early and everything after it is parsed as
 * HTML. Escaping every `<` as `\u003C` closes that hole and also neutralizes `<!--`,
 * which the HTML spec's script-data escaping rules treat specially.
 *
 * Every emitter that interpolates app-controlled data into a `<script>` must route
 * through this function — `buildStateScript`, the per-boundary data patch, and the
 * head patch all do. Safe for any script element including data blocks
 * (`type="application/json"`, JSON-LD), since `JSON.parse` accepts `\u003C`.
 *
 * NOT valid anywhere else. `\u003C` is a JavaScript escape, so it renders literally
 * in an HTML attribute (use {@link escapeHtml}) and is not a CSS escape, so it does
 * not work inside `<style>`. An inline event handler attribute needs both JS and
 * HTML-attribute escaping; neither helper alone is correct there.
 */
export function jsStringInScript(value: unknown): string {
  return JSON.stringify(value ?? '').replace(/</g, '\\u003C');
}

/**
 * Escape an already-serialized JSON string for embedding inside an inline `<script>`.
 * Same rationale as {@link jsStringInScript}, for callers that have JSON in hand.
 */
export function jsonInScript(json: string): string {
  return json.replace(/</g, '\\u003C');
}

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
