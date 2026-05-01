import { describe, it, expect } from 'vitest';
import { renderToStream, renderToString } from './stream.js';
import { jsx, Suspense, _LazyBoundary } from '@stewie-js/core';
import type { Component, JSXElement, _LazyBoundaryProps } from '@stewie-js/core';
import type { SSRManifest } from './types.js';

// Collect all chunks from a ReadableStream into an array
async function collectChunks(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    if (text) chunks.push(text);
  }
  return chunks;
}

async function collectAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  return (await collectChunks(stream)).join('');
}

describe('renderToStream', () => {
  it('returns a ReadableStream<Uint8Array>', () => {
    const stream = renderToStream(jsx('div', { children: 'hello' }));
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it('produces correct HTML for a simple element', async () => {
    const html = await collectAll(renderToStream(jsx('p', { children: 'world' })));
    expect(html).toContain('<p>world</p>');
  });

  it('produces correct HTML for nested elements', async () => {
    const html = await collectAll(
      renderToStream(
        jsx('div', {
          class: 'wrapper',
          children: jsx('span', { children: 'nested' })
        })
      )
    );
    expect(html).toContain('<div class="wrapper"><span>nested</span></div>');
  });

  it('sends multiple chunks — does not buffer the entire response', async () => {
    // A tree with a nested async component. The outer shell chunks should
    // arrive before the slow component resolves.
    async function SlowChild(): Promise<JSXElement> {
      await new Promise((r) => setTimeout(r, 10));
      return jsx('span', { children: 'slow' });
    }

    const chunks = await collectChunks(
      renderToStream(
        jsx('div', {
          children: [jsx('header', { children: 'fast' }), jsx(SlowChild as unknown as Component, {})]
        })
      )
    );

    // Must receive more than one chunk (streaming, not buffered)
    expect(chunks.length).toBeGreaterThan(1);

    // The opening div tag arrives in an early chunk, before the slow content
    const divChunkIndex = chunks.findIndex((c) => c.includes('<div>'));
    const slowChunkIndex = chunks.findIndex((c) => c.includes('slow'));
    expect(divChunkIndex).toBeLessThan(slowChunkIndex);

    const fullHtml = chunks.join('');
    expect(fullHtml).toContain('<header>fast</header>');
    expect(fullHtml).toContain('slow');
  });

  it('streams Suspense fallback immediately, then injects resolved content', async () => {
    async function SlowData(): Promise<JSXElement> {
      await new Promise((r) => setTimeout(r, 10));
      return jsx('p', { 'data-testid': 'result', children: 'loaded' });
    }

    const chunks = await collectChunks(
      renderToStream(
        jsx(Suspense as unknown as Component, {
          fallback: jsx('p', { children: 'Loading...' }),
          children: jsx(SlowData as unknown as Component, {})
        })
      )
    );

    const fullHtml = chunks.join('');

    // Fallback is present in the initial output
    expect(fullHtml).toContain('Loading...');
    // Real content appears after the fallback resolves
    expect(fullHtml).toContain('loaded');
    // A swap script is injected
    expect(fullHtml).toContain('<script>');

    // The fallback chunk arrives before the real content chunk
    const fallbackChunkIndex = chunks.findIndex((c) => c.includes('Loading...'));
    const realContentChunkIndex = chunks.findIndex((c) => c.includes('loaded'));
    expect(fallbackChunkIndex).toBeLessThan(realContentChunkIndex);
  });

  it('includes __STEWIE_STATE__ script at the end', async () => {
    const html = await collectAll(renderToStream(jsx('div', { children: 'ok' })));
    expect(html).toContain('__STEWIE_STATE__');
    // State script should be at the end of the stream
    const stateIndex = html.indexOf('__STEWIE_STATE__');
    const divIndex = html.indexOf('<div>');
    expect(stateIndex).toBeGreaterThan(divIndex);
  });

  it('emits <link rel="stylesheet"> and <link rel="modulepreload"> for lazy boundary assets via manifest, deduped', async () => {
    function makeLazy(id: string): JSXElement {
      const lazyProps: _LazyBoundaryProps = {
        loaded: () => true,
        render: () => jsx('span', { children: `body-${id}` }),
        id
      };
      return { type: _LazyBoundary as unknown, props: lazyProps as unknown as Record<string, unknown>, key: null } as JSXElement;
    }

    const manifest = {
      'src/pages/foo.tsx': ['/assets/foo.css', '/assets/foo.js'],
      'src/pages/bar.tsx': ['/assets/foo.css', '/assets/bar.css', '/assets/bar.mjs']
    };

    const html = await collectAll(
      renderToStream(
        jsx('div', { children: [makeLazy('src/pages/foo.tsx'), makeLazy('src/pages/bar.tsx'), makeLazy('src/pages/foo.tsx')] }),
        { manifest }
      )
    );

    expect(html).toContain('<link rel="stylesheet" href="/assets/foo.css">');
    expect(html).toContain('<link rel="stylesheet" href="/assets/bar.css">');
    // Phase 2: JS chunks emit modulepreload hints so the browser warms the
    // module graph in parallel with the streamed HTML.
    expect(html).toContain('<link rel="modulepreload" href="/assets/foo.js">');
    expect(html).toContain('<link rel="modulepreload" href="/assets/bar.mjs">');
    // Deduped — only one <link> tag for shared assets across boundaries.
    // (The asset URL also appears in __STEWIE_MANIFEST__ JSON, so match specifically on <link> tags.)
    const fooCssLinkMatches = html.match(/<link rel="stylesheet" href="\/assets\/foo\.css">/g);
    expect(fooCssLinkMatches?.length).toBe(1);
    const fooJsLinkMatches = html.match(/<link rel="modulepreload" href="\/assets\/foo\.js">/g);
    expect(fooJsLinkMatches?.length).toBe(1);
  });

  it('escapes HTML entities in text content', async () => {
    const html = await collectAll(renderToStream(jsx('p', { children: '<script>evil</script>' })));
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>evil</script>');
  });

  it('emits __STEWIE_MANIFEST__ with only rendered lazy ids (renderToStream)', async () => {
    function makeLazy(id: string): JSXElement {
      const lazyProps: _LazyBoundaryProps = {
        loaded: () => true,
        render: () => jsx('span', { children: id }),
        id
      };
      return { type: _LazyBoundary as unknown, props: lazyProps as unknown as Record<string, unknown>, key: null } as JSXElement;
    }

    const manifest: SSRManifest = {
      'src/pages/AdminPage.tsx': ['/assets/AdminPage.css', '/assets/AdminPage.js'],
      'src/pages/NotRendered.tsx': ['/assets/NotRendered.css']
    };

    const html = await collectAll(renderToStream(jsx('div', { children: makeLazy('src/pages/AdminPage.tsx') }), { manifest }));

    // __STEWIE_MANIFEST__ must be present and contain only the rendered boundary
    expect(html).toContain('__STEWIE_MANIFEST__');
    const manifestMatch = html.match(/window\.__STEWIE_MANIFEST__ = ({.*?})/);
    expect(manifestMatch).not.toBeNull();
    const parsed = JSON.parse(manifestMatch![1]);
    expect(parsed).toHaveProperty('src/pages/AdminPage.tsx');
    expect(parsed['src/pages/AdminPage.tsx']).toEqual(['/assets/AdminPage.css', '/assets/AdminPage.js']);
    // Non-rendered id must be absent
    expect(parsed).not.toHaveProperty('src/pages/NotRendered.tsx');
  });

  it('emits no __STEWIE_MANIFEST__ when no lazy boundaries are rendered', async () => {
    const manifest: SSRManifest = {
      'src/pages/AdminPage.tsx': ['/assets/AdminPage.css']
    };
    const html = await collectAll(renderToStream(jsx('div', { children: 'no lazy here' }), { manifest }));
    expect(html).not.toContain('__STEWIE_MANIFEST__');
  });
});

describe('renderToString — manifest emission', () => {
  function makeLazy(id: string): JSXElement {
    const lazyProps: _LazyBoundaryProps = {
      loaded: () => true,
      render: () => jsx('span', { children: id }),
      id
    };
    return { type: _LazyBoundary as unknown, props: lazyProps as unknown as Record<string, unknown>, key: null } as JSXElement;
  }

  it('lifts lazy boundary <link> tags into headHtml', async () => {
    const manifest: SSRManifest = {
      'src/pages/AdminPage.tsx': ['/assets/AdminPage.css', '/assets/AdminPage.js']
    };
    const result = await renderToString(jsx('div', { children: makeLazy('src/pages/AdminPage.tsx') }), { manifest });

    expect(result.headHtml).toContain('<link rel="stylesheet" href="/assets/AdminPage.css">');
    expect(result.headHtml).toContain('<link rel="modulepreload" href="/assets/AdminPage.js">');
    // Link tags should NOT be in the body html
    expect(result.html).not.toContain('<link rel="stylesheet"');
  });

  it('emits __STEWIE_MANIFEST__ in stateScript with only rendered ids', async () => {
    const manifest: SSRManifest = {
      'src/pages/AdminPage.tsx': ['/assets/AdminPage.css', '/assets/AdminPage.js'],
      'src/pages/Other.tsx': ['/assets/Other.css']
    };
    const result = await renderToString(jsx('div', { children: makeLazy('src/pages/AdminPage.tsx') }), { manifest });

    expect(result.stateScript).toContain('__STEWIE_MANIFEST__');
    const manifestMatch = result.stateScript.match(/window\.__STEWIE_MANIFEST__ = ({.*?})/);
    expect(manifestMatch).not.toBeNull();
    const parsed = JSON.parse(manifestMatch![1]);
    expect(parsed).toHaveProperty('src/pages/AdminPage.tsx');
    expect(parsed).not.toHaveProperty('src/pages/Other.tsx');
  });

  it('emits no __STEWIE_MANIFEST__ when manifest has no rendered boundaries', async () => {
    const manifest: SSRManifest = {
      'src/pages/AdminPage.tsx': ['/assets/AdminPage.css']
    };
    const result = await renderToString(jsx('div', { children: 'plain content, no lazy' }), { manifest });
    expect(result.stateScript).not.toContain('__STEWIE_MANIFEST__');
  });
});
