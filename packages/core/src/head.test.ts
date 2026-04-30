// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { reactiveScope, signal } from './reactive.js';
import { useTitle, useMeta } from './head.js';

function withScope(fn: () => void): () => void {
  let dispose!: () => void;
  reactiveScope((d) => {
    dispose = d;
    fn();
  });
  return dispose;
}

describe('useTitle — client', () => {
  beforeEach(() => {
    document.title = '';
  });

  it('sets document.title from a static string', () => {
    withScope(() => useTitle('My App'));
    expect(document.title).toBe('My App');
  });

  it('sets document.title from an accessor', () => {
    let dispose!: () => void;
    let $title!: ReturnType<typeof signal<string>>;
    reactiveScope((d) => {
      dispose = d;
      $title = signal('Home');
      useTitle(() => $title());
    });
    expect(document.title).toBe('Home');

    $title.set('About');
    expect(document.title).toBe('About');

    dispose();
  });

  it('sets document.title from a Signal directly', () => {
    let dispose!: () => void;
    let $title!: ReturnType<typeof signal<string>>;
    reactiveScope((d) => {
      dispose = d;
      $title = signal('First');
      useTitle($title);
    });
    expect(document.title).toBe('First');

    $title.set('Second');
    expect(document.title).toBe('Second');

    dispose();
  });

  it('last call wins when multiple useTitle calls are active', () => {
    const d1 = withScope(() => useTitle('First'));
    const d2 = withScope(() => useTitle('Second'));
    expect(document.title).toBe('Second');
    d1();
    d2();
  });

  it('does not restore prior title on cleanup', () => {
    document.title = 'Original';
    const dispose = withScope(() => useTitle('Overlay'));
    expect(document.title).toBe('Overlay');
    dispose();
    // Title stays as-is; no restoration
    expect(document.title).toBe('Overlay');
  });
});

describe('useMeta — client', () => {
  beforeEach(() => {
    // Remove any meta tags added by tests
    for (const el of Array.from(document.head.querySelectorAll('meta[name], meta[property]'))) {
      el.parentNode?.removeChild(el);
    }
  });

  it('inserts a <meta name> tag with static content', () => {
    const dispose = withScope(() => useMeta({ name: 'description', content: 'Hello world' }));
    const meta = document.head.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('Hello world');
    dispose();
  });

  it('removes the inserted tag on cleanup', () => {
    const dispose = withScope(() => useMeta({ name: 'description', content: 'Test' }));
    expect(document.head.querySelector('meta[name="description"]')).not.toBeNull();
    dispose();
    expect(document.head.querySelector('meta[name="description"]')).toBeNull();
  });

  it('updates content reactively via accessor', () => {
    let dispose!: () => void;
    let $desc!: ReturnType<typeof signal<string>>;
    reactiveScope((d) => {
      dispose = d;
      $desc = signal('Initial');
      useMeta({ name: 'description', content: () => $desc() });
    });

    const meta = document.head.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(meta.getAttribute('content')).toBe('Initial');

    $desc.set('Updated');
    expect(meta.getAttribute('content')).toBe('Updated');

    dispose();
  });

  it('supports Signal directly as content', () => {
    let dispose!: () => void;
    let $kw!: ReturnType<typeof signal<string>>;
    reactiveScope((d) => {
      dispose = d;
      $kw = signal('stewie');
      useMeta({ name: 'keywords', content: $kw });
    });

    const meta = document.head.querySelector('meta[name="keywords"]') as HTMLMetaElement;
    expect(meta.getAttribute('content')).toBe('stewie');

    $kw.set('stewie, framework');
    expect(meta.getAttribute('content')).toBe('stewie, framework');

    dispose();
  });

  it('supports { property, content } form for OpenGraph tags', () => {
    const dispose = withScope(() => useMeta({ property: 'og:title', content: 'My Page' }));
    const meta = document.head.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('My Page');
    dispose();
  });

  it('reuses an existing meta tag instead of inserting a duplicate', () => {
    const existing = document.createElement('meta');
    existing.setAttribute('name', 'author');
    existing.setAttribute('content', 'Old');
    document.head.appendChild(existing);

    // useMeta should update the existing tag, not insert a new one
    const dispose = withScope(() => useMeta({ name: 'author', content: 'New' }));
    const metas = document.head.querySelectorAll('meta[name="author"]');
    expect(metas.length).toBe(1);
    expect((metas[0] as HTMLMetaElement).getAttribute('content')).toBe('New');

    // Since useMeta did not insert the tag, cleanup should not remove it
    dispose();
    expect(document.head.querySelector('meta[name="author"]')).not.toBeNull();

    existing.parentNode?.removeChild(existing);
  });
});
