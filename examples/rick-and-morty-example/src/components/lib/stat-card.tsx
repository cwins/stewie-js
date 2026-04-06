import { Show } from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'
import { Card } from './card.js'

export function StatCard({
  label,
  value,
  hint
}: {
  label: string
  value: string
  hint?: string | null
}): JSXElement {
  return (
    <Card class="stat-card">
      <div class="stat-card__label">{label}</div>
      <div class="stat-card__value">{value}</div>
      <Show when={Boolean(hint)}>{hint ? <div class="stat-card__hint">{hint}</div> : <span />}</Show>
    </Card>
  )
}
