/// <reference types="vite/client" />
import type { JSXElement } from '@stewie-js/core';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: JSXElement;
  testId?: string;
}

export function EmptyState({ title, description, action, testId }: EmptyStateProps): JSXElement {
  return (
    <div class="empty-state" data-testid={testId}>
      <p class="empty-state-title">{title}</p>
      {description ? <p class="empty-state-desc">{description}</p> : null}
      {action ?? null}
    </div>
  );
}
