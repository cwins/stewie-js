import { Show } from '@stewie-js/core';
import type { JSXElement } from '@stewie-js/core';
import { Button } from './button.js';
import { Card } from './card.js';
import { Icon } from './icon.js';

export function ErrorState({
  title = 'Signal lost in the multiverse',
  message,
  onRetry
}: {
  title?: string;
  message: string;
  onRetry?: (() => void) | null;
}): JSXElement {
  return (
    <Card class="message-card message-card--error">
      <h3 class="message-card__title">{title}</h3>
      <p class="message-card__body">{message}</p>
      <Show when={Boolean(onRetry)}>
        {onRetry ? (
          <div class="message-card__actions">
            <Button variant="secondary" onClick={onRetry}>
              {[<Icon name="refresh" />, 'Retry']}
            </Button>
          </div>
        ) : (
          <span />
        )}
      </Show>
    </Card>
  );
}
