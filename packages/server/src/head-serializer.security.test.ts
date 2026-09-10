// head-serializer.security.test.ts — hostile input must not escape the <script> element.
//
// serializeHeadPatch embeds app-controlled strings (titles, meta content) into an
// inline <script> during streaming SSR. Titles routinely derive from user data
// ("Search results for {q}", "{user.name}'s profile"), so a value containing
// `</script>` must not be able to terminate the element and inject markup.

import { describe, it, expect } from 'vitest';
import type { HeadEntry } from '@stewie-js/core';
import { serializeHeadPatch } from './head-serializer.js';
import { jsStringInScript, jsonInScript } from './serializer.js';

/** Everything between the opening <script ...> and the first closing tag the parser would see. */
function scriptBody(html: string): string {
  const open = html.indexOf('>') + 1;
  const close = html.indexOf('</script', open);
  return close === -1 ? html.slice(open) : html.slice(open, close);
}

const BREAKOUT = '</script><script>alert(1)</script>';

describe('serializeHeadPatch — script breakout', () => {
  it('does not let a hostile title close the script element', () => {
    const html = serializeHeadPatch([{ type: 'title', title: BREAKOUT } as HeadEntry]);
    // The only `</script` in the output is the real closing tag at the very end.
    expect(html.indexOf('</script')).toBe(html.length - '</script>'.length);
    expect(scriptBody(html)).not.toContain('</script');
    expect(html).not.toContain('<script>alert(1)');
  });

  it('does not let hostile meta content close the script element', () => {
    const html = serializeHeadPatch([{ type: 'meta', attrs: { name: 'description', content: BREAKOUT } } as HeadEntry]);
    expect(scriptBody(html)).not.toContain('</script');
    expect(html).not.toContain('<script>alert(1)');
  });

  it('does not let a hostile meta name close the script element', () => {
    const html = serializeHeadPatch([{ type: 'meta', attrs: { name: BREAKOUT, content: 'x' } } as HeadEntry]);
    expect(scriptBody(html)).not.toContain('</script');
  });

  it('neutralizes <!-- so script-data escaping rules cannot be triggered', () => {
    const html = serializeHeadPatch([{ type: 'title', title: '<!--<script>' } as HeadEntry]);
    expect(scriptBody(html)).not.toContain('<!--');
    expect(scriptBody(html)).not.toContain('<script');
  });

  it('survives a quote in a meta attribute value without breaking the lookup', () => {
    // Previously the value was interpolated into a querySelector string, so an
    // embedded quote produced an invalid selector that threw at runtime.
    const html = serializeHeadPatch([{ type: 'meta', attrs: { name: 'og:title', content: 'He said "hi"' } } as HeadEntry]);
    expect(scriptBody(html)).not.toContain('querySelector');
    expect(() => new Function(scriptBody(html))).not.toThrow();
  });

  it('still round-trips the real value', () => {
    const title = `Results for </script> & "quotes" & <tags>`;
    const html = serializeHeadPatch([{ type: 'title', title } as HeadEntry]);
    // Evaluate the emitted statement against a fake document and check the value survives.
    const doc = { title: '' };
    new Function('document', scriptBody(html))(doc);
    expect(doc.title).toBe(title);
  });

  it('emits nothing for an empty entry list', () => {
    expect(serializeHeadPatch([])).toBe('');
  });
});

describe('script-embedding helpers', () => {
  it('jsStringInScript escapes every <', () => {
    expect(jsStringInScript('</script>')).not.toContain('<');
    expect(jsStringInScript('<!--')).not.toContain('<');
    expect(JSON.parse(jsStringInScript('</script>'))).toBe('</script>');
  });

  it('jsonInScript escapes every < while staying valid JSON', () => {
    const json = JSON.stringify({ a: '</script>' });
    expect(jsonInScript(json)).not.toContain('<');
    expect(JSON.parse(jsonInScript(json))).toEqual({ a: '</script>' });
  });

  it('jsStringInScript handles null and undefined', () => {
    expect(jsStringInScript(undefined)).toBe('""');
    expect(jsStringInScript(null)).toBe('""');
  });
});

// ---------------------------------------------------------------------------
// Emitted-script shape and behavior
// ---------------------------------------------------------------------------

/** Minimal stand-in for the document surface the emitted patch touches. */
function fakeDocument() {
  const metas: Array<{ attrs: Record<string, string>; getAttribute(k: string): string | null; setAttribute(k: string, v: string): void }> =
    [];
  const make = () => {
    const el = {
      attrs: {} as Record<string, string>,
      getAttribute(k: string) {
        return el.attrs[k] ?? null;
      },
      setAttribute(k: string, v: string) {
        el.attrs[k] = v;
      }
    };
    return el;
  };
  return {
    title: '',
    head: {
      getElementsByTagName: (tag: string) => (tag === 'meta' ? metas : []),
      appendChild: (el: ReturnType<typeof make>) => {
        metas.push(el);
      }
    },
    createElement: (_tag: string) => make(),
    _metas: metas
  };
}

/** Run an emitted patch against a fake document. */
function runPatch(html: string, doc: unknown) {
  new Function('document', scriptBody(html))(doc);
}

describe('serializeHeadPatch — emitted script', () => {
  it('emits the meta helper once no matter how many meta entries there are', () => {
    const html = serializeHeadPatch([
      { type: 'meta', attrs: { name: 'a', content: '1' } },
      { type: 'meta', attrs: { name: 'b', content: '2' } },
      { type: 'meta', attrs: { property: 'og:c', content: '3' } }
    ] as HeadEntry[]);
    expect(scriptBody(html).match(/getElementsByTagName/g)).toHaveLength(1);
    expect(scriptBody(html).match(/setMeta\(/g)).toHaveLength(4); // 1 declaration + 3 calls
  });

  it('emits no meta helper for a title-only patch', () => {
    const html = serializeHeadPatch([{ type: 'title', title: 'x' }] as HeadEntry[]);
    expect(scriptBody(html)).not.toContain('setMeta');
    expect(scriptBody(html)).not.toContain('getElementsByTagName');
    expect(scriptBody(html)).not.toContain('(function()');
  });

  it('creates a missing meta tag and updates an existing one', () => {
    const doc = fakeDocument();

    runPatch(serializeHeadPatch([{ type: 'meta', attrs: { name: 'description', content: 'first' } }] as HeadEntry[]), doc);
    expect(doc._metas).toHaveLength(1);
    expect(doc._metas[0].attrs).toEqual({ name: 'description', content: 'first' });

    // A later boundary flush reuses the hoisted helper and upserts in place.
    runPatch(serializeHeadPatch([{ type: 'meta', attrs: { name: 'description', content: 'second' } }] as HeadEntry[]), doc);
    expect(doc._metas).toHaveLength(1);
    expect(doc._metas[0].attrs.content).toBe('second');
  });

  it('keeps name and property in separate identity namespaces', () => {
    const doc = fakeDocument();
    runPatch(
      serializeHeadPatch([
        { type: 'meta', attrs: { name: 'title', content: 'as-name' } },
        { type: 'meta', attrs: { property: 'title', content: 'as-property' } }
      ] as HeadEntry[]),
      doc
    );
    expect(doc._metas).toHaveLength(2);
  });

  it('round-trips a hostile attribute value through the real lookup', () => {
    const doc = fakeDocument();
    const nasty = 'He said "hi" </script>';
    runPatch(serializeHeadPatch([{ type: 'meta', attrs: { name: 'og:title', content: nasty } }] as HeadEntry[]), doc);
    expect(doc._metas[0].attrs.content).toBe(nasty);
  });
});
