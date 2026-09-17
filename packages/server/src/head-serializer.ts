// head-serializer.ts — serialize HeadEntry[] to HTML strings for SSR emission

import type { HeadEntry } from '@stewie-js/core';
import { escapeHtml, jsStringInScript } from './serializer.js';

/**
 * Serialize a list of HeadEntry values to an HTML string.
 * `<title>` entries are emitted in order; last one wins in the browser (one title per
 * document), but we emit all collected ones so the outermost shell can do its own merge.
 * `<meta>` entries use `name` or `property` attribute as appropriate.
 */
export function serializeHeadEntries(entries: HeadEntry[]): string {
  return entries
    .map((entry) => {
      if (entry.type === 'title') {
        return `<title>${escapeHtml(entry.title ?? '')}</title>`;
      }
      if (entry.type === 'meta' && entry.attrs) {
        const attrs = Object.entries(entry.attrs)
          .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
          .join(' ');
        return `<meta ${attrs} />`;
      }
      return '';
    })
    .join('');
}

/**
 * Produce an inline `<script>` that sets `document.title` and patches meta tags.
 * Used when head updates are emitted as part of a Suspense boundary flush (streaming SSR).
 */
export function serializeHeadPatch(entries: HeadEntry[], nonce?: string): string {
  if (entries.length === 0) return '';

  const nonceAttr = nonce ? ` nonce="${escapeHtml(nonce)}"` : '';
  const lines: string[] = [];
  const metaCalls: string[] = [];

  for (const entry of entries) {
    if (entry.type === 'title' && entry.title !== undefined) {
      lines.push(`document.title=${jsStringInScript(entry.title)};`);
    } else if (entry.type === 'meta' && entry.attrs) {
      const attrKey = 'name' in entry.attrs ? 'name' : 'property';
      metaCalls.push(
        `setMeta(` +
          `${jsStringInScript(attrKey)},` +
          `${jsStringInScript(entry.attrs[attrKey])},` +
          `${jsStringInScript(entry.attrs.content ?? '')}` +
          `);`
      );
    }
  }

  // Emit the upsert routine once, scoped to an IIFE, with every meta call for
  // this patch inside it. Keeping it out of the global scope means app code (or
  // another script on the page) cannot clobber it and silently break a later
  // boundary's head patch. Skipped entirely when the patch has no meta entries.
  if (metaCalls.length > 0) {
    lines.push(
      `(function(){` +
        `function setMeta(k,v,c){` +
        // Scan existing <meta> elements instead of building a querySelector
        // string: an attribute value containing a quote would produce an
        // invalid selector and throw, aborting the rest of the patch.
        `var l=document.head.getElementsByTagName('meta'),m=null;` +
        `for(var i=0;i<l.length;i++){if(l[i].getAttribute(k)===v){m=l[i];break;}}` +
        `if(!m){m=document.createElement('meta');m.setAttribute(k,v);document.head.appendChild(m);}` +
        `m.setAttribute('content',c);` +
        `}` +
        metaCalls.join('') +
        `})();`
    );
  }

  if (lines.length === 0) return '';
  return `<script${nonceAttr}>${lines.join('')}</script>`;
}
