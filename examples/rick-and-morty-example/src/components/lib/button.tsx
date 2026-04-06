import type { ButtonAttributes, JSXElement } from '@stewie-js/core'
import { cx } from '../../utils/format.js'

export function Button({
  variant = 'primary',
  size = 'md',
  class: className,
  children,
  ...rest
}: {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'sm'
  class?: string
  children: JSXElement | string | Array<JSXElement | string>
} & ButtonAttributes): JSXElement {
  return (
    <button
      {...rest}
      class={cx('button', `button--${variant}`, size === 'sm' && 'button--sm', className)}
    >
      {children}
    </button>
  )
}
