// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { jsx } from '@stewie-js/core'
import { mount } from '@stewie-js/core'
import { createRoot } from '@stewie-js/core'
import { renderToString } from '@stewie-js/server'
import { Router, Route, Link } from './components.js'
import { createRouter, RouterContext, useRouter } from './router.js'
import { matchRoute } from './matcher.js'

// ---------------------------------------------------------------------------
// SSR: Router renders matched route
// ---------------------------------------------------------------------------

describe('Router SSR rendering', () => {
  function Home() {
    return jsx('div', { children: 'Home Page' })
  }
  function About() {
    return jsx('div', { children: 'About Page' })
  }
  function User({ params }: { params: Record<string, string> }) {
    return jsx('div', { children: `User ${params.id}` })
  }

  it('renders the matched route component', async () => {
    const el = jsx(Router as any, {
      initialUrl: '/',
      children: [
        jsx(Route as any, { path: '/', component: Home }),
        jsx(Route as any, { path: '/about', component: About }),
      ],
    })
    const { html } = await renderToString(el)
    expect(html).toContain('Home Page')
    expect(html).not.toContain('About Page')
  })

  it('renders the correct route for a non-root path', async () => {
    const el = jsx(Router as any, {
      initialUrl: '/about',
      children: [
        jsx(Route as any, { path: '/', component: Home }),
        jsx(Route as any, { path: '/about', component: About }),
      ],
    })
    const { html } = await renderToString(el)
    expect(html).toContain('About Page')
    expect(html).not.toContain('Home Page')
  })

  it('passes route params to matched component', async () => {
    const el = jsx(Router as any, {
      initialUrl: '/users/42',
      children: [jsx(Route as any, { path: '/users/:id', component: User as any })],
    })
    const { html } = await renderToString(el)
    expect(html).toContain('User 42')
  })

  it('renders nothing when no route matches', async () => {
    const el = jsx(Router as any, {
      initialUrl: '/no-match',
      children: [jsx(Route as any, { path: '/', component: Home })],
    })
    const { html } = await renderToString(el)
    expect(html).not.toContain('Home Page')
  })

  it('provides RouterContext to child components via useRouter()', async () => {
    let capturedPathname = ''
    function Reader() {
      const router = useRouter()
      capturedPathname = router.location.pathname
      return jsx('span', { children: router.location.pathname })
    }
    const el = jsx(Router as any, {
      initialUrl: '/test-path',
      children: [jsx(Route as any, { path: '/test-path', component: Reader })],
    })
    await renderToString(el)
    expect(capturedPathname).toBe('/test-path')
  })
})

// ---------------------------------------------------------------------------
// DOM: Router renders matched route + reacts to navigation
// ---------------------------------------------------------------------------

describe('Router DOM rendering', () => {
  function Home() {
    return jsx('div', { children: 'Home' })
  }
  function About() {
    return jsx('div', { children: 'About' })
  }

  it('mounts the matched route in the DOM', () => {
    const container = document.createElement('div')
    createRoot(() => {
      mount(
        jsx(Router as any, {
          initialUrl: '/',
          children: [
            jsx(Route as any, { path: '/', component: Home }),
            jsx(Route as any, { path: '/about', component: About }),
          ],
        }),
        container,
      )
    })
    expect(container.textContent).toContain('Home')
    expect(container.textContent).not.toContain('About')
  })

  it('re-renders when the router navigates', () => {
    const container = document.createElement('div')
    // Use createRouter directly so we can keep a reference
    const router = createRouter('/')

    function HomeComp() {
      return jsx('div', { children: 'Home' })
    }
    function AboutComp() {
      return jsx('div', { children: 'About' })
    }

    createRoot(() => {
      // Provide router context manually and render a reactive child
      const routes = [
        { path: '/', component: HomeComp },
        { path: '/about', component: AboutComp },
      ]
      router._routes = routes

      const matchedContent = () => {
        let best: any = null
        for (const r of routes) {
          const result = matchRoute(r.path, router.location.pathname)
          if (result && (!best || result.score > best.score)) {
            best = { ...r, params: result.params }
          }
        }
        if (!best) return null
        router.location.params = best.params
        return jsx(best.component, { params: best.params })
      }

      mount(
        jsx(RouterContext.Provider as any, {
          value: router,
          children: matchedContent,
        }),
        container,
      )
    })

    expect(container.textContent).toContain('Home')
    router.navigate('/about')
    expect(container.textContent).toContain('About')
    expect(container.textContent).not.toContain('Home')
  })
})

// ---------------------------------------------------------------------------
// navigate() updates params
// ---------------------------------------------------------------------------

describe('Router navigate() params', () => {
  it('updates location.params after navigating to a parameterised route', () => {
    const router = createRouter('/')
    router._routes = [{ path: '/users/:id', component: null as any }]
    router.navigate('/users/99')
    expect(router.location.pathname).toBe('/users/99')
    expect(router.location.params).toEqual({ id: '99' })
  })

  it('clears params when navigating to a non-parameterised route', () => {
    const router = createRouter('/users/5')
    router._routes = [
      { path: '/users/:id', component: null as any },
      { path: '/about', component: null as any },
    ]
    router.navigate('/about')
    expect(router.location.params).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Link component
// ---------------------------------------------------------------------------

describe('Link SSR', () => {
  it('renders an anchor tag with href', async () => {
    const el = jsx(Link as any, { to: '/about', children: 'Go' })
    const { html } = await renderToString(el)
    expect(html).toContain('<a href="/about">')
    expect(html).toContain('Go')
  })

  it('renders class when provided', async () => {
    const el = jsx(Link as any, { to: '/x', class: 'nav-link', children: 'X' })
    const { html } = await renderToString(el)
    expect(html).toContain('class="nav-link"')
  })

  it('does not emit onClick as an HTML attribute', async () => {
    // Link inside a Router — has a router context
    function WithLink() {
      return jsx(Link as any, { to: '/other', children: 'Link' })
    }
    const el = jsx(Router as any, {
      initialUrl: '/',
      children: [jsx(Route as any, { path: '/', component: WithLink })],
    })
    const { html } = await renderToString(el)
    expect(html).not.toContain('onClick')
    expect(html).toContain('href="/other"')
  })
})

describe('Link DOM', () => {
  it('prevents default and navigates on click when inside Router', () => {
    const container = document.createElement('div')
    const router = createRouter('/')
    router._routes = [
      { path: '/', component: null as any },
      { path: '/about', component: null as any },
    ]

    createRoot(() => {
      mount(
        jsx(RouterContext.Provider as any, {
          value: router,
          children: jsx(Link as any, { to: '/about', children: 'About' }),
        }),
        container,
      )
    })

    const link = container.querySelector('a')!
    expect(link).not.toBeNull()

    let prevented = false
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const orig = clickEvent.preventDefault.bind(clickEvent)
    clickEvent.preventDefault = () => {
      prevented = true
      orig()
    }
    link.dispatchEvent(clickEvent)

    expect(prevented).toBe(true)
    expect(router.location.pathname).toBe('/about')
  })

  it('does not navigate on modifier+click', () => {
    const container = document.createElement('div')
    const router = createRouter('/')

    createRoot(() => {
      mount(
        jsx(RouterContext.Provider as any, {
          value: router,
          children: jsx(Link as any, { to: '/about', children: 'About' }),
        }),
        container,
      )
    })

    const link = container.querySelector('a')!
    let prevented = false
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    })
    clickEvent.preventDefault = () => {
      prevented = true
    }
    link.dispatchEvent(clickEvent)

    expect(prevented).toBe(false)
    expect(router.location.pathname).toBe('/')
  })

  it('renders as plain anchor without router context', async () => {
    const { html } = await renderToString(jsx(Link as any, { to: '/x', children: 'X' }))
    expect(html).toContain('href="/x"')
  })
})
