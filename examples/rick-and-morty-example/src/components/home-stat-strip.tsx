import type { JSXElement } from '@stewie-js/core'
import { For } from '@stewie-js/core'
import { Card } from './lib/card.js'

export function HomeStatStrip({
  stats
}: {
  stats: Array<{ label: string; value: string; hint: string }>
}): JSXElement {
  return (
    <div class="stat-strip">
      <For each={stats}>
        {(stat: () => { label: string; value: string; hint: string }) => (
          <Card class="stat-strip__card">
            <div class="stat-strip__label">{stat().label}</div>
            <div class="stat-strip__value">{stat().value}</div>
            <div class="stat-strip__hint">{stat().hint}</div>
          </Card>
        )}
      </For>
    </div>
  )
}
