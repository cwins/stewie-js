import type { JSXElement } from '@stewie-js/core';

const GLYPHS = {
  spark: '✦',
  search: '⌕',
  people: '◉',
  episode: '◎',
  location: '◌',
  arrow: '→',
  back: '←',
  refresh: '↻'
} as const;

export function Icon({ name, class: className }: { name: keyof typeof GLYPHS; class?: string }): JSXElement {
  return (
    <span aria-hidden="true" class={className ? `icon ${className}` : 'icon'}>
      {GLYPHS[name]}
    </span>
  );
}
