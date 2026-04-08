/**
 * renderer-consistency.test.ts
 *
 * Verifies that renderToString and renderToStream produce byte-for-byte identical
 * HTML for every anchor-producing construct that HydrationCursor relies on:
 *
 *   <!---->      function children
 *   <!--Show-->  Show / Match
 *   <!--For-->   For
 *   <!--Switch--> Switch
 *   <!--Lazy-->  _LazyBoundary (lazy())
 *
 * Each test asserts:
 *   1. The exact expected HTML string (documents the contract).
 *   2. Both renderers produce the same string (no divergence).
 *
 * Suspense is intentionally excluded: renderToStream uses a placeholder-div +
 * swap-script mechanism that is structurally different from renderToString by
 * design. Suspense consistency is covered in stream.test.ts separately.
 */

import { describe, it, expect } from 'vitest';
import { jsx, Show, For, Switch, Match, _LazyBoundary } from '@stewie-js/core';
import type { JSXElement, Component, _LazyBoundaryProps } from '@stewie-js/core';
import { renderToString } from './renderer.js';
import { renderToStream } from './stream.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render via renderToString; return only the HTML (no state script). */
async function str(tree: JSXElement): Promise<string> {
  const { html } = await renderToString(tree);
  return html;
}

/** Render via renderToStream; collect all chunks and strip the trailing state script. */
async function stream(tree: JSXElement): Promise<string> {
  const reader = renderToStream(tree).getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(decoder.decode(value));
  }
  const full = chunks.join('');
  // Strip the trailing __STEWIE_STATE__ script — not part of the HTML structure
  // being tested and its key ordering is non-deterministic across registry instances.
  return full.replace(/<script[^>]*>window\.__STEWIE_STATE__[\s\S]*?<\/script>$/, '');
}

/** Assert both renderers agree and match the expected string. */
async function assertConsistent(tree: JSXElement, expected: string): Promise<void> {
  const [s, st] = await Promise.all([str(tree), stream(tree)]);
  expect(s, 'renderToString output').toBe(expected);
  expect(st, 'renderToStream output').toBe(expected);
}

// ---------------------------------------------------------------------------
// Function children  -->  one <!----> anchor per slot
// ---------------------------------------------------------------------------

describe('renderer consistency: function children', () => {
  it('emits <!----> after a function child returning a string', async () => {
    const tree = jsx('div', { children: () => 'hello' });
    await assertConsistent(tree, '<div>hello<!----></div>');
  });

  it('emits <!----> after a function child returning an element', async () => {
    const tree = jsx('div', { children: () => jsx('span', { children: 'hi' }) });
    await assertConsistent(tree, '<div><span>hi</span><!----></div>');
  });

  it('emits <!----> after a function child returning null', async () => {
    const tree = jsx('div', { children: () => null });
    await assertConsistent(tree, '<div><!----></div>');
  });

  it('folds one level: function returning a function emits one anchor (Signal child folding)', async () => {
    // The dom-renderer folds () => () => value into one effect with one anchor.
    // Both SSR renderers must match this so HydrationCursor stays in sync.
    const tree = jsx('div', { children: () => () => 'deep' });
    await assertConsistent(tree, '<div>deep<!----></div>');
  });

  it('each sibling function child gets its own anchor', async () => {
    const tree = jsx('div', {
      children: [() => 'a', () => 'b']
    });
    await assertConsistent(tree, '<div>a<!---->b<!----></div>');
  });
});

// ---------------------------------------------------------------------------
// Show  -->  <!--Show--> anchor always present
// ---------------------------------------------------------------------------

describe('renderer consistency: Show', () => {
  it('when=true: renders children + <!--Show-->', async () => {
    const tree = jsx(Show as unknown as Component, {
      when: true,
      children: jsx('span', { children: 'visible' })
    });
    await assertConsistent(tree, '<span>visible</span><!--Show-->');
  });

  it('when=false, no fallback: emits only <!--Show-->', async () => {
    const tree = jsx(Show as unknown as Component, {
      when: false,
      children: jsx('span', { children: 'hidden' })
    });
    await assertConsistent(tree, '<!--Show-->');
  });

  it('when=false, with fallback: renders fallback + <!--Show-->', async () => {
    const tree = jsx(Show as unknown as Component, {
      when: false,
      children: jsx('span', { children: 'hidden' }),
      fallback: jsx('span', { children: 'fallback' })
    });
    await assertConsistent(tree, '<span>fallback</span><!--Show-->');
  });

  it('when=true with function when prop: evaluates and renders children', async () => {
    const tree = jsx(Show as unknown as Component, {
      when: () => true,
      children: jsx('p', { children: 'yes' })
    });
    await assertConsistent(tree, '<p>yes</p><!--Show-->');
  });

  it('when=false with function when prop: emits only <!--Show-->', async () => {
    const tree = jsx(Show as unknown as Component, {
      when: () => false,
      children: jsx('p', { children: 'no' })
    });
    await assertConsistent(tree, '<!--Show-->');
  });

  it('nested Show: each has its own <!--Show--> anchor', async () => {
    const tree = jsx(Show as unknown as Component, {
      when: true,
      children: jsx(Show as unknown as Component, {
        when: true,
        children: jsx('span', { children: 'inner' })
      })
    });
    await assertConsistent(tree, '<span>inner</span><!--Show--><!--Show-->');
  });
});

// ---------------------------------------------------------------------------
// For  -->  <!--For--> anchor always present
// ---------------------------------------------------------------------------

describe('renderer consistency: For', () => {
  it('empty array: emits only <!--For-->', async () => {
    const tree = jsx(For as unknown as Component, {
      each: [],
      children: (item: () => string) => jsx('li', { children: item() })
    });
    await assertConsistent(tree, '<!--For-->');
  });

  it('non-empty array: renders items + <!--For-->', async () => {
    const tree = jsx(For as unknown as Component, {
      each: ['a', 'b', 'c'],
      children: (item: () => string) => jsx('li', { children: item() })
    });
    await assertConsistent(tree, '<li>a</li><li>b</li><li>c</li><!--For-->');
  });

  it('For with function each prop: evaluates and renders', async () => {
    const tree = jsx(For as unknown as Component, {
      each: () => [1, 2],
      children: (item: () => number) => jsx('span', { children: String(item()) })
    });
    await assertConsistent(tree, '<span>1</span><span>2</span><!--For-->');
  });

  it('non-array each: emits only <!--For-->', async () => {
    const tree = jsx(For as unknown as Component, {
      each: null as unknown as unknown[],
      children: (item: () => unknown) => jsx('li', { children: String(item()) })
    });
    await assertConsistent(tree, '<!--For-->');
  });
});

// ---------------------------------------------------------------------------
// Switch / Match  -->  <!--Switch--> anchor always present
// ---------------------------------------------------------------------------

describe('renderer consistency: Switch', () => {
  it('first matching branch renders + <!--Switch-->', async () => {
    const tree = jsx(Switch as unknown as Component, {
      children: [
        jsx(Match as unknown as Component, { when: false, children: jsx('span', { children: 'no' }) }),
        jsx(Match as unknown as Component, { when: true, children: jsx('span', { children: 'yes' }) })
      ]
    });
    await assertConsistent(tree, '<span>yes</span><!--Switch-->');
  });

  it('no match, no fallback: emits only <!--Switch-->', async () => {
    const tree = jsx(Switch as unknown as Component, {
      children: [jsx(Match as unknown as Component, { when: false, children: jsx('span', { children: 'no' }) })]
    });
    await assertConsistent(tree, '<!--Switch-->');
  });

  it('no match with fallback: renders fallback + <!--Switch-->', async () => {
    const tree = jsx(Switch as unknown as Component, {
      fallback: jsx('span', { children: 'default' }),
      children: [jsx(Match as unknown as Component, { when: false, children: jsx('span', { children: 'no' }) })]
    });
    await assertConsistent(tree, '<span>default</span><!--Switch-->');
  });

  it('Match with function when: evaluates condition', async () => {
    const tree = jsx(Switch as unknown as Component, {
      children: [jsx(Match as unknown as Component, { when: () => true, children: jsx('em', { children: 'matched' }) })]
    });
    await assertConsistent(tree, '<em>matched</em><!--Switch-->');
  });

  it('Match with function children: passes the matched value', async () => {
    const tree = jsx(Switch as unknown as Component, {
      children: [
        jsx(Match as unknown as Component, {
          when: 'hello',
          children: (v: string) => jsx('span', { children: v })
        })
      ]
    });
    await assertConsistent(tree, '<span>hello</span><!--Switch-->');
  });
});

// ---------------------------------------------------------------------------
// _LazyBoundary  -->  <!--Lazy--> anchor always present
// ---------------------------------------------------------------------------

describe('renderer consistency: _LazyBoundary', () => {
  it('not loaded: emits only <!--Lazy-->', async () => {
    const tree = jsx(
      _LazyBoundary as unknown as Component,
      {
        loaded: () => false,
        render: () => jsx('span', { children: 'content' })
      } as unknown as _LazyBoundaryProps
    );
    await assertConsistent(tree, '<!--Lazy-->');
  });

  it('loaded: renders content + <!--Lazy-->', async () => {
    const tree = jsx(
      _LazyBoundary as unknown as Component,
      {
        loaded: () => true,
        render: () => jsx('span', { children: 'loaded' })
      } as unknown as _LazyBoundaryProps
    );
    await assertConsistent(tree, '<span>loaded</span><!--Lazy-->');
  });
});

// ---------------------------------------------------------------------------
// Nested / composed cases
// ---------------------------------------------------------------------------

describe('renderer consistency: nested control flow', () => {
  it('Show inside For: each item gets its own Show anchor, then For anchor', async () => {
    const tree = jsx(For as unknown as Component, {
      each: [true, false],
      children: (item: () => boolean) =>
        jsx(Show as unknown as Component, {
          when: item(),
          children: jsx('span', { children: 'yes' }),
          fallback: jsx('span', { children: 'no' })
        })
    });
    await assertConsistent(tree, '<span>yes</span><!--Show--><span>no</span><!--Show--><!--For-->');
  });

  it('function child inside Show: function anchor inside Show anchor', async () => {
    const tree = jsx(Show as unknown as Component, {
      when: true,
      children: () => jsx('p', { children: 'reactive' })
    });
    await assertConsistent(tree, '<p>reactive</p><!----><!--Show-->');
  });

  it('For inside Show: For anchor inside Show anchor', async () => {
    const tree = jsx(Show as unknown as Component, {
      when: true,
      children: jsx(For as unknown as Component, {
        each: ['x', 'y'],
        children: (item: () => string) => jsx('li', { children: item() })
      })
    });
    await assertConsistent(tree, '<li>x</li><li>y</li><!--For--><!--Show-->');
  });

  it('function child inside For item: one anchor per item slot', async () => {
    const tree = jsx(For as unknown as Component, {
      each: ['a', 'b'],
      children: (item: () => string) => jsx('div', { children: () => item() })
    });
    await assertConsistent(tree, '<div>a<!----></div><div>b<!----></div><!--For-->');
  });

  it('deeply nested: Switch inside Show inside a wrapper', async () => {
    const tree = jsx('section', {
      children: jsx(Show as unknown as Component, {
        when: true,
        children: jsx(Switch as unknown as Component, {
          children: [jsx(Match as unknown as Component, { when: true, children: jsx('b', { children: 'deep' }) })]
        })
      })
    });
    await assertConsistent(tree, '<section><b>deep</b><!--Switch--><!--Show--></section>');
  });
});
