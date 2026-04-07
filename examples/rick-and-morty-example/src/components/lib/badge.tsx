import type { JSXElement } from '@stewie-js/core';
import { cx } from '../../utils/format.js';

export function Badge({
  tone = 'neutral',
  children,
  class: className
}: {
  tone?: 'alive' | 'dead' | 'unknown' | 'meta' | 'neutral';
  children: string;
  class?: string;
}): JSXElement {
  return <span class={cx('badge', `badge--${tone}`, className)}>{children}</span>;
}
