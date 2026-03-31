// @vitest-environment node
/**
 * Edge contract tests — prove that Stewie's server APIs use only Web Platform
 * primitives (Request, Response, ReadableStream, URL, Headers) so they work in
 * WinterCG-compatible runtimes, not just Node.
 *
 * These tests also verify basic parity between renderToString and renderToStream:
 * both renderers must emit equivalent structural HTML and hydration markers so
 * that either can be used to produce hydration-safe output.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from './renderer.js';
import { renderToStream } from './stream.js';
import { jsx, Show, For } from '@stewie-js/core';

// ---------------------------------------------------------------------------
// Helpers — minimal edge-style harness (no Node http, no Express)
// ---------------------------------------------------------------------------

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) result += decoder.decode(value);
  }
  return result;
}

async function collectStreamChunks(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(decoder.decode(value));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Web API availability — these must exist for any of the contract tests to mean
// anything. If a runtime is missing these, Stewie cannot claim edge-first.
// ---------------------------------------------------------------------------

describe('edge: Web API availability', () => {
  it('Request is available', () => {
    expect(typeof Request).toBe('function');
  });
  it('Response is available', () => {
    expect(typeof Response).toBe('function');
  });
  it('ReadableStream is available', () => {
    expect(typeof ReadableStream).toBe('function');
  });
  it('URL is available', () => {
    expect(typeof URL).toBe('function');
  });
  it('Headers is available', () => {
    expect(typeof Headers).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// renderToString — Web API contract
// ---------------------------------------------------------------------------

describe('edge: renderToString — Response contract', () => {
  it('output wraps cleanly in a standard Response', async () => {
    const { html } = await renderToString(jsx('div', { children: 'hello edge' }));
    const res = new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toContain('hello edge');
  });

  it('a guard redirect is a proper 302 Response with no HTML body', async () => {
    // Pattern: handler checks guard result before rendering
    const handler = async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      if (url.pathname === '/protected') {
        return new Response(null, { status: 302, headers: { location: '/login' } });
      }
      const { html } = await renderToString(jsx('div', { children: 'ok' }));
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    };

    const redirectRes = await handler(new Request('http://app.test/protected'));
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get('location')).toBe('/login');
    expect(await redirectRes.text()).toBe('');

    const okRes = await handler(new Request('http://app.test/other'));
    expect(okRes.status).toBe(200);
    expect(await okRes.text()).toContain('ok');
  });

  it('URL and Headers from Request are standard Web API objects', () => {
    const req = new Request('http://app.test/page?tab=overview', {
      headers: { 'x-forwarded-for': '1.2.3.4' }
    });
    const url = new URL(req.url);
    expect(url.pathname).toBe('/page');
    expect(url.searchParams.get('tab')).toBe('overview');
    expect(req.headers.get('x-forwarded-for')).toBe('1.2.3.4');
  });
});

// ---------------------------------------------------------------------------
// renderToStream — Web API contract
// ---------------------------------------------------------------------------

describe('edge: renderToStream — Response contract', () => {
  it('returns a ReadableStream usable directly in a Response body', async () => {
    const stream = renderToStream(jsx('div', { children: 'streamed' }));
    expect(stream).toBeInstanceOf(ReadableStream);
    const res = new Response(stream, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('streamed');
  });

  it('stream chunks are read via WHATWG reader API, no Node streams involved', async () => {
    const stream = renderToStream(jsx('p', { children: 'chunk test' }));
    const chunks = await collectStreamChunks(stream);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('chunk test');
  });
});

// ---------------------------------------------------------------------------
// String / stream parity
// ---------------------------------------------------------------------------

describe('edge: renderToString / renderToStream parity', () => {
  it('both renderers produce the same structural HTML for a native element', async () => {
    const el = jsx('article', { class: 'post', children: 'content' });
    const { html } = await renderToString(el);
    const streamed = await collectStream(renderToStream(el));
    expect(html).toContain('<article class="post">content</article>');
    expect(streamed).toContain('<article class="post">content</article>');
  });

  it('both renderers emit <!--Show--> anchor for hydration cursor', async () => {
    const el = Show({ when: true, children: jsx('span', { children: 'visible' }) });
    const { html } = await renderToString(el);
    const streamed = await collectStream(renderToStream(el));
    expect(html).toContain('<!--Show-->');
    expect(streamed).toContain('<!--Show-->');
    expect(html).toContain('visible');
    expect(streamed).toContain('visible');
  });

  it('both renderers emit <!--For--> anchor for hydration cursor', async () => {
    const el = For({
      each: ['a', 'b', 'c'],
      children: (item: string) => jsx('li', { children: item })
    });
    const { html } = await renderToString(el);
    const streamed = await collectStream(renderToStream(el));
    expect(html).toContain('<!--For-->');
    expect(streamed).toContain('<!--For-->');
    expect(html).toContain('<li>a</li>');
    expect(streamed).toContain('<li>a</li>');
  });

  it('Show false case: both renderers emit empty <!--Show--> anchor', async () => {
    const el = Show({ when: false, children: jsx('span', { children: 'hidden' }) });
    const { html } = await renderToString(el);
    const streamed = await collectStream(renderToStream(el));
    // Both must emit the anchor (empty Show) — hydration cursor requires it
    expect(html).toContain('<!--Show-->');
    expect(streamed).toContain('<!--Show-->');
    // Content must not appear
    expect(html).not.toContain('hidden');
    expect(streamed).not.toContain('hidden');
  });
});
