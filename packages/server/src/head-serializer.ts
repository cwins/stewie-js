// head-serializer.ts — serialize HeadEntry[] to HTML strings for SSR emission

import type { HeadEntry } from '@stewie-js/core';
import { escapeHtml } from './serializer.js';

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

  for (const entry of entries) {
    if (entry.type === 'title' && entry.title !== undefined) {
      lines.push(`document.title=${JSON.stringify(entry.title)};`);
    } else if (entry.type === 'meta' && entry.attrs) {
      const attrKey = 'name' in entry.attrs ? 'name' : 'property';
      const attrValue = entry.attrs[attrKey];
      const content = entry.attrs.content ?? '';
      lines.push(
        `(function(){` +
          `var m=document.head.querySelector('meta[${attrKey}="'+${JSON.stringify(attrValue)}+'"]');` +
          `if(!m){m=document.createElement('meta');m.setAttribute(${JSON.stringify(attrKey)},${JSON.stringify(attrValue)});document.head.appendChild(m);}` +
          `m.setAttribute('content',${JSON.stringify(content)});` +
          `})()`
      );
    }
  }

  if (lines.length === 0) return '';
  return `<script${nonceAttr}>${lines.join('')}</script>`;
}
