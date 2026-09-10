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
    const html = serializeHeadPatch([
      { type: 'meta', attrs: { name: 'description', content: BREAKOUT } } as HeadEntry
    ]);
    expect(scriptBody(html)).not.toContain('</script');
    expect(html).not.toContain('<script>alert(1)');
  });

  it('does not let a hostile meta name close the script element', () => {
    const html = serializeHeadPatch([
      { type: 'meta', attrs: { name: BREAKOUT, content: 'x' } } as HeadEntry
    ]);
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
    const html = serializeHeadPatch([
      { type: 'meta', attrs: { name: 'og:title', content: 'He said "hi"' } } as HeadEntry
    ]);
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
