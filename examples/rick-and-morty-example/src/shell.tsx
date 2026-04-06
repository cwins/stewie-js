import type { JSXElement } from '@stewie-js/core'
import { Nav } from './nav.js'

export function Shell({ children }: { children: JSXElement }): JSXElement {
  return (
    <div class="app-shell">
      <Nav />
      <main class="page-shell">{children}</main>
    </div>
  )
}
