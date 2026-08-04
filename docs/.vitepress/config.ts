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

  themeConfig: {
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
