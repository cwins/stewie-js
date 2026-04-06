import type { InputAttributes, JSXElement } from '@stewie-js/core'
import { cx } from '../../utils/format.js'

export function Input({
  class: className,
  ...rest
}: {
  class?: string
} & InputAttributes): JSXElement {
  return <input {...rest} class={cx('field', className)} />
}
