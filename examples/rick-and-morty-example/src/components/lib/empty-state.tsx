import { Show } from '@stewie-js/core';
import type { JSXElement } from '@stewie-js/core';
import { Card } from './card.js';

export function EmptyState({ title, message, action }: { title: string; message: string; action?: JSXElement | null }): JSXElement {
  return (
    <Card class="message-card">
      <h3 class="message-card__title">{title}</h3>
      <p class="message-card__body">{message}</p>
      <Show when={Boolean(action)}>{action ?? <span />}</Show>
    </Card>
  );
}
