import { For } from '@stewie-js/core';
import type { JSXElement } from '@stewie-js/core';
import { Card } from './card.js';

export function LoadingBlock({ lines = 3, card = true }: { lines?: number; card?: boolean }): JSXElement {
  const content = (
    <div class="loading-block">
      <For each={Array.from({ length: lines }, (_, index) => index)}>
        {(index: () => number) => <div class="loading-line" style={`width: ${92 - index() * 11}%`} />}
      </For>
    </div>
  );

  return card ? <Card>{content}</Card> : content;
}
