import { describe, it, expect } from 'vitest';
import { renderToString } from './stream.js';
import { renderToStream } from './stream.js';
import { jsx, Suspense, useTitle, useMeta } from '@stewie-js/core';

// ---------------------------------------------------------------------------
// Helper: drain a ReadableStream<Uint8Array> to a string
// ---------------------------------------------------------------------------

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function TitleComp() {
  useTitle('SSR Title');
  return jsx('div', { children: 'content' });
}

function MetaComp() {
  useMeta({ name: 'description', content: 'SSR description' });
  return jsx('div', { children: 'content' });
}

function OGComp() {
  useMeta({ property: 'og:title', content: 'My OG Title' });
  return jsx('div', { children: 'content' });
}

function BothComp() {
  useTitle('Combined');
  useMeta({ name: 'description', content: 'Desc' });
  return jsx('div', { children: 'content' });
}

// ---------------------------------------------------------------------------
// renderToString — head collection
// ---------------------------------------------------------------------------

describe('renderToString — head collection', () => {
  it('collects useTitle into headHtml', async () => {
    const { headHtml } = await renderToString(jsx(TitleComp, {}));
    expect(headHtml).toContain('<title>SSR Title</title>');
  });

  it('collects useMeta { name } into headHtml', async () => {
    const { headHtml } = await renderToString(jsx(MetaComp, {}));
    expect(headHtml).toContain('name="description"');
    expect(headHtml).toContain('content="SSR description"');
  });

  it('collects useMeta { property } into headHtml for OpenGraph', async () => {
    const { headHtml } = await renderToString(jsx(OGComp, {}));
    expect(headHtml).toContain('property="og:title"');
    expect(headHtml).toContain('content="My OG Title"');
  });

  it('collects both title and meta into headHtml', async () => {
    const { headHtml } = await renderToString(jsx(BothComp, {}));
    expect(headHtml).toContain('<title>Combined</title>');
    expect(headHtml).toContain('name="description"');
  });

  it('returns empty headHtml when no head primitives used', async () => {
    const { headHtml } = await renderToString(jsx('div', { children: 'hello' }));
    expect(headHtml).toBe('');
  });

  it('escapes HTML in title', async () => {
    function XSSTitle() {
      useTitle('<script>alert(1)</script>');
      return jsx('span', {});
    }
    const { headHtml } = await renderToString(jsx(XSSTitle, {}));
    expect(headHtml).not.toContain('<script>alert(1)</script>');
    expect(headHtml).toContain('&lt;script&gt;');
  });

  it('escapes HTML in meta content to prevent attribute injection', async () => {
    function XSSMeta() {
      useMeta({ name: 'description', content: '"><img src=x>' });
      return jsx('span', {});
    }
    const { headHtml } = await renderToString(jsx(XSSMeta, {}));
    // The injected " is escaped to &quot; — attribute boundary injection is prevented
    expect(headHtml).toContain('&quot;');
    // The raw unescaped sequence must not appear
    expect(headHtml).not.toContain('"><img');
  });

  it('html field contains rendered component output', async () => {
    const { html } = await renderToString(jsx(TitleComp, {}));
    expect(html).toContain('<div>content</div>');
  });
});

// ---------------------------------------------------------------------------
// renderToStream — shell head and Suspense boundary patches
// ---------------------------------------------------------------------------

describe('renderToStream — head emission', () => {
  it('emits shell-level title tags in the stream', async () => {
    const stream = renderToStream(jsx(TitleComp, {}));
    const output = await readStream(stream);
    expect(output).toContain('<title>SSR Title</title>');
  });

  it('emits shell-level meta tags in the stream', async () => {
    const stream = renderToStream(jsx(MetaComp, {}));
    const output = await readStream(stream);
    expect(output).toContain('name="description"');
    expect(output).toContain('content="SSR description"');
  });

  it('emits an inline head patch script for useTitle inside a Suspense boundary', async () => {
    function LazyTitleComp() {
      useTitle('Lazy Title');
      return jsx('div', { children: 'resolved' });
    }

    const root = Suspense({
      fallback: jsx('div', { children: 'loading...' }),
      children: jsx(LazyTitleComp, {})
    });

    const stream = renderToStream(root);
    const output = await readStream(stream);

    // The Suspense boundary resolved immediately, so its patch should appear
    expect(output).toContain('document.title');
    expect(output).toContain('Lazy Title');
  });

  it('emits an inline head patch script for useMeta inside a Suspense boundary', async () => {
    function LazyMetaComp() {
      useMeta({ name: 'keywords', content: 'lazy, kw' });
      return jsx('div', { children: 'resolved' });
    }

    const root = Suspense({
      fallback: jsx('div', { children: 'loading...' }),
      children: jsx(LazyMetaComp, {})
    });

    const stream = renderToStream(root);
    const output = await readStream(stream);

    expect(output).toContain('keywords');
    expect(output).toContain('lazy, kw');
  });
});
