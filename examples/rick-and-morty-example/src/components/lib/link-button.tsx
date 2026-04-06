import type { JSXElement } from '@stewie-js/core'
import { Link } from '@stewie-js/router'
import { cx } from '../../utils/format.js'

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  class: className,
  children
}: {
  to: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'sm'
  class?: string
  children: JSXElement | string | JSXElement[]
}): JSXElement {
  return (
    <Link to={to} class={cx('button', `button--${variant}`, size === 'sm' && 'button--sm', className)}>
      {children}
    </Link>
  )
}
