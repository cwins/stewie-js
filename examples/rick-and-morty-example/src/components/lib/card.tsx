import type { JSXElement } from '@stewie-js/core'
import { cx } from '../../utils/format.js'

export function Card({
  class: className,
  interactive = false,
  children
}: {
  class?: string
  interactive?: boolean
  children: JSXElement | string | Array<JSXElement | string | null> | null
}): JSXElement {
  return <div class={cx('card', interactive && 'card--interactive', className)}>{children}</div>
}
