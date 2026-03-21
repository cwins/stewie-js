// components.ts — route components (using jsx() directly, no .tsx needed)

import { jsx } from '@stewie/core'
import type { JSXElement, Component } from '@stewie/core'
import { createRouter } from './router.js'
import type { RouterStore } from './location.js'

export interface RouterProps {
  initialUrl?: string
  children: JSXElement | JSXElement[]
}

export function Router(props: RouterProps): JSXElement {
  const router = createRouter(props.initialUrl ?? '/')
  return jsx('__stewie_router__', { router, children: props.children })
}

export interface RouteProps {
  path: string
  component: Component
}

export function Route(props: RouteProps): JSXElement {
  return jsx('__stewie_route__', props as unknown as Record<string, unknown>)
}

export interface LinkProps {
  to: string
  replace?: boolean
  children: JSXElement | JSXElement[] | string
  class?: string
}

export function Link(props: LinkProps): JSXElement {
  // Link renders as an anchor element
  return jsx('a', {
    href: props.to,
    class: props.class,
    children: props.children,
    // onClick handler would prevent default and use router.navigate in browser
  })
}
