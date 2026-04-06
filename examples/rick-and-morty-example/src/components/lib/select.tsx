import { For } from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'
import { cx } from '../../utils/format.js'

export function Select({
  class: className,
  value,
  onChange,
  options
}: {
  class?: string
  value: string
  onChange: (e: Event) => void
  options: Array<{ label: string; value: string }>
}): JSXElement {
  return (
    <select class={cx('field', 'field--select', className)} value={value} onChange={onChange}>
      <For each={options}>
        {(option: () => { label: string; value: string }) => <option value={option().value}>{option().label}</option>}
      </For>
    </select>
  )
}
