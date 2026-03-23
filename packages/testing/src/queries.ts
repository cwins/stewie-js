// queries.ts — HTML string-based DOM query utilities

export interface ElementHandle {
  tagName: string
  textContent: string
  getAttribute(name: string): string | null
  innerHTML: string
  outerHTML: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Parse attributes from an opening tag string into a key/value map
function parseAttributes(tagStr: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  // Match attribute="value", attribute='value', or standalone attribute
  const attrRegex = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  // Skip the tag name at the start
  const withoutTag = tagStr.replace(/^<\s*\w+/, '')
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(withoutTag)) !== null) {
    const name = match[1]
    // The value is whichever capture group matched (double-quote, single-quote, unquoted)
    const value =
      match[2] !== undefined
        ? match[2]
        : match[3] !== undefined
          ? match[3]
          : match[4] !== undefined
            ? match[4]
            : ''
    attrs[name] = value
  }
  return attrs
}

// Build an ElementHandle from tag name, full attributes string, and inner HTML
function buildHandle(tagName: string, openTag: string, innerHTML: string): ElementHandle {
  const attrs = parseAttributes(openTag)
  // Strip all HTML tags to get text content
  const textContent = innerHTML.replace(/<[^>]*>/g, '')
  // outerHTML includes the inner content between the opening and closing tag
  const outerHTML = `${openTag}${innerHTML}</${tagName}>`

  return {
    tagName,
    textContent,
    getAttribute(name: string): string | null {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null
    },
    innerHTML,
    outerHTML,
  }
}

// Extract all elements matching a given tag name from an HTML string.
// Returns handles for each matched element (non-nested — grabs outermost match).
function extractElements(html: string, tag: string): ElementHandle[] {
  const results: ElementHandle[] = []
  // Match opening tag (capture full open tag), then content, then closing tag
  // This regex handles simple non-nested cases well enough for test scenarios
  const openTagPattern = new RegExp(`(<${tag}(?:\\s[^>]*)?>)`, 'gi')
  const closeTag = `</${tag}>`
  let match: RegExpExecArray | null

  while ((match = openTagPattern.exec(html)) !== null) {
    const openTag = match[1]
    const startIndex = match.index + openTag.length
    // Find the matching close tag (simple — works for non-deeply-nested same-tag content)
    const closeIndex = html.indexOf(closeTag, startIndex)
    if (closeIndex === -1) continue

    const innerHTML = html.slice(startIndex, closeIndex)
    results.push(buildHandle(tag.toLowerCase(), openTag, innerHTML))
  }

  return results
}

// Check if element's text content contains the given text
function hasText(el: ElementHandle, text: string): boolean {
  return el.textContent.includes(text)
}

// ---------------------------------------------------------------------------
// Role → tag name mapping
// ---------------------------------------------------------------------------

const ROLE_TO_TAGS: Record<string, string[]> = {
  button: ['button'],
  heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  link: ['a'],
  textbox: ['input', 'textarea'],
  checkbox: ['input'],
  radio: ['input'],
  listitem: ['li'],
  list: ['ul', 'ol'],
  navigation: ['nav'],
  main: ['main'],
  banner: ['header'],
  contentinfo: ['footer'],
  article: ['article'],
  region: ['section'],
  form: ['form'],
  img: ['img'],
  table: ['table'],
  row: ['tr'],
  cell: ['td', 'th'],
}

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

export function findByText(html: string, text: string): ElementHandle | null {
  // Strip the state script tag to avoid matching text inside it
  const htmlWithoutScript = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')

  // Common block/inline tags to search through
  const tags = [
    'div',
    'span',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'button',
    'a',
    'li',
    'td',
    'th',
    'label',
    'section',
    'article',
    'header',
    'footer',
    'main',
    'nav',
    'aside',
    'strong',
    'em',
    'small',
    'b',
    'i',
    'code',
    'pre',
  ]

  for (const tag of tags) {
    const elements = extractElements(htmlWithoutScript, tag)
    for (const el of elements) {
      if (hasText(el, text)) {
        return el
      }
    }
  }

  return null
}

export function findByTestId(html: string, id: string): ElementHandle | null {
  // Match any element that has data-testid="id"
  const pattern = new RegExp(`(<([\\w-]+)[^>]*data-testid="${id}"[^>]*>)`, 'i')
  const match = pattern.exec(html)
  if (!match) return null

  const openTag = match[1]
  const tagName = match[2].toLowerCase()
  const closeTag = `</${tagName}>`
  const startIndex = match.index + openTag.length
  const closeIndex = html.indexOf(closeTag, startIndex)
  if (closeIndex === -1) return null

  const innerHTML = html.slice(startIndex, closeIndex)
  return buildHandle(tagName, openTag, innerHTML)
}

export function findByRole(
  html: string,
  role: string,
  options?: { name?: string },
): ElementHandle | null {
  const tags = ROLE_TO_TAGS[role]
  if (!tags) return null

  for (const tag of tags) {
    const elements = extractElements(html, tag)
    for (const el of elements) {
      // For roles that require a specific input type, verify the type attribute
      if (role === 'checkbox' && el.getAttribute('type') !== 'checkbox') continue
      if (role === 'radio' && el.getAttribute('type') !== 'radio') continue
      if (role === 'textbox' && el.tagName === 'input') {
        const type = el.getAttribute('type')
        // textbox role applies to text-like inputs; exclude button/submit/checkbox etc.
        const NON_TEXTBOX = [
          'checkbox',
          'radio',
          'button',
          'submit',
          'reset',
          'file',
          'image',
          'range',
          'color',
        ]
        if (type && NON_TEXTBOX.includes(type)) continue
      }
      if (options?.name) {
        // Filter by accessible name: check text content or aria-label
        const ariaLabel = el.getAttribute('aria-label')
        const matchesName =
          (ariaLabel && ariaLabel.includes(options.name)) || hasText(el, options.name)
        if (!matchesName) continue
      }
      return el
    }
  }

  return null
}
