import { describe, it, expect } from 'vitest';
import { renderToString } from './renderer.js';
// Import JSX runtime to construct test elements
import { jsx, Fragment, Show, For, ClientOnly, ErrorBoundary, createContext, inject } from '@stewie-js/core';
import { useHydrationRegistry } from './hydration.js';

describe('renderToString', () => {
  it('renders a simple div', async () => {
    const el = jsx('div', { class: 'foo', children: 'Hello' });
    const { html } = await renderToString(el);
    expect(html).toContain('<div class="foo">Hello</div>');
  });

  it('renders nested elements', async () => {
    const el = jsx('div', { children: jsx('span', { children: 'world' }) });
    const { html } = await renderToString(el);
    expect(html).toContain('<div><span>world</span></div>');
  });

  it('escapes HTML in text content', async () => {
    const el = jsx('div', { children: '<script>alert(1)</script>' });
    const { html } = await renderToString(el);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
    // The raw string should not appear unescaped in the content portion
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('renders void elements self-closing', async () => {
    const el = jsx('input', { type: 'text' });
    const { html } = await renderToString(el);
    expect(html).toMatch(/<input[^>]*\/>/);
  });

  it('renders Fragment', async () => {
    const el = jsx(Fragment, {
      children: [jsx('span', { children: 'a' }), jsx('span', { children: 'b' })]
    });
    const { html } = await renderToString(el);
    expect(html).toContain('<span>a</span><span>b</span>');
  });

  it('renders component function', async () => {
    function MyComp({ name }: Record<string, unknown>) {
      return jsx('p', { children: `Hello ${name as string}` });
    }
    const el = jsx(MyComp, { name: 'world' });
    const { html } = await renderToString(el);
    expect(html).toContain('<p>Hello world</p>');
  });

  it('Show renders children when true', async () => {
    const el = Show({ when: true, children: jsx('span', { children: 'visible' }) });
    const { html } = await renderToString(el);
    expect(html).toContain('<span>visible</span>');
  });

  it('Show renders fallback when false', async () => {
    const el = Show({
      when: false,
      children: jsx('span', { children: 'hidden' }),
      fallback: jsx('span', { children: 'fallback' })
    });
    const { html } = await renderToString(el);
    expect(html).toContain('<span>fallback</span>');
    expect(html).not.toContain('hidden');
  });

  it('For renders list items', async () => {
    const el = For({
      each: ['a', 'b', 'c'],
      children: (item: () => string) => jsx('li', { children: item() })
    });
    const { html } = await renderToString(el);
    expect(html).toContain('<li>a</li>');
    expect(html).toContain('<li>b</li>');
    expect(html).toContain('<li>c</li>');
  });

  it('ClientOnly renders empty on server', async () => {
    const el = ClientOnly({ children: jsx('div', { children: 'client only' }) });
    const { html } = await renderToString(el);
    // ClientOnly renders no content — only the hydration state script is emitted
    expect(html).not.toContain('client only');
    expect(html).not.toContain('<div>');
  });

  it('omits event handlers (onClick etc)', async () => {
    const el = jsx('button', { onClick: () => {}, children: 'click' });
    const { html } = await renderToString(el);
    expect(html).not.toContain('onClick');
    expect(html).toContain('<button>click</button>');
  });

  it('returns html and stateScript separately', async () => {
    const el = jsx('div', { children: 'test' });
    const { html, stateScript } = await renderToString(el);
    expect(html).not.toContain('__STEWIE_STATE__');
    expect(stateScript).toContain('__STEWIE_STATE__');
    expect(stateScript).toContain('<script');
  });

  it('ErrorBoundary catches errors and renders fallback', async () => {
    function Broken() {
      throw new Error('boom');
    }
    const el = ErrorBoundary({
      fallback: (err: unknown) => jsx('div', { children: `Error: ${(err as Error).message}` }),
      children: jsx(Broken as any, {})
    });
    const { html } = await renderToString(el);
    expect(html).toContain('Error: boom');
  });

  it('reactive attributes (functions) are called', async () => {
    const el = jsx('div', { class: () => 'dynamic' });
    const { html } = await renderToString(el);
    expect(html).toContain('class="dynamic"');
  });

  it('Context.Provider threads context to child components', async () => {
    const ThemeCtx = createContext('light');
    function Child() {
      const theme = inject(ThemeCtx);
      return jsx('div', { children: theme });
    }
    const el = jsx(ThemeCtx.Provider as any, {
      value: 'dark',
      children: jsx(Child, {})
    });
    const { html } = await renderToString(el);
    expect(html).toContain('<div>dark</div>');
  });

  it('nested Context.Provider — innermost wins', async () => {
    const Ctx = createContext('outer');
    function Inner() {
      return jsx('span', { children: inject(Ctx) });
    }
    const el = jsx(Ctx.Provider as any, {
      value: 'outer',
      children: jsx(Ctx.Provider as any, {
        value: 'inner',
        children: jsx(Inner, {})
      })
    });
    const { html } = await renderToString(el);
    expect(html).toContain('<span>inner</span>');
  });

  it('useHydrationRegistry() is available in component body', async () => {
    let capturedRegistry: ReturnType<typeof useHydrationRegistry> = null;
    function RecordingComp() {
      capturedRegistry = useHydrationRegistry();
      return jsx('div', { children: 'ok' });
    }
    await renderToString(jsx(RecordingComp, {}));
    expect(capturedRegistry).not.toBeNull();
  });

  it('async component can call inject() before first await', async () => {
    const Ctx = createContext('default');
    async function AsyncComp() {
      // inject() before any await — must work
      const val = inject(Ctx);
      await Promise.resolve();
      return jsx('span', { children: val });
    }
    const el = jsx(Ctx.Provider as any, {
      value: 'async-value',
      children: jsx(AsyncComp as any, {})
    });
    const { html } = await renderToString(el);
    expect(html).toContain('<span>async-value</span>');
  });
});
