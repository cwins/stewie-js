import { defineConfig } from 'vitepress';

// VitePress site config for the Stewie docs.
// `docs/` is the site root; `index.md` is the landing page.
export default defineConfig({
  title: 'Stewie',
  description: 'A small, coherent TypeScript web framework for modern runtimes.',
  // Deployed as a GitHub project page at https://cwins.github.io/stewie-js/
  base: '/stewie-js/',
  cleanUrls: true,
  lastUpdated: true,

  // Favicons are generated from the logo's "S" glyph — the full mark is too
  // wide to stay legible at 16px. Paths are `base`-prefixed because
  // `head` links are not rewritten by VitePress.
  head: [
    ['link', { rel: 'icon', href: '/stewie-js/favicon.ico', sizes: 'any' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/stewie-js/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/stewie-js/favicon-16x16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/stewie-js/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#276ccd' }],
    ['meta', { property: 'og:image', content: 'https://cwins.github.io/stewie-js/stewie-logo.png' }]
  ],

  themeConfig: {
    logo: { src: '/stewie-logo.png', alt: 'Stewie' },

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'The Stewie Way', link: '/guide/stewie-way' },
      { text: 'Reference', link: '/reference/core-api' }
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Reactivity', link: '/guide/reactivity' },
          { text: 'Components', link: '/guide/components' },
          { text: 'Routing', link: '/guide/routing' },
          { text: 'Server-Side Rendering', link: '/guide/ssr' },
          { text: 'The Stewie Way', link: '/guide/stewie-way' }
        ]
      },
      {
        text: 'Patterns',
        items: [
          { text: 'Reactive Branches & Child Props', link: '/patterns/reactive-branches' },
          { text: 'Derived Collections', link: '/patterns/derived-collections' },
          { text: 'When to Use reactiveScope', link: '/patterns/reactive-scope' }
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Core API', link: '/reference/core-api' },
          { text: 'Router API', link: '/reference/router-api' },
          { text: 'Server API', link: '/reference/server-api' },
          { text: 'Diagnostics', link: '/reference/diagnostics' }
        ]
      }
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/cwins/stewie-js' }],

    search: { provider: 'local' }
  }
});
