import { defineConfig, type HeadConfig } from 'vitepress';

/**
 * Google Analytics (GA4) is injected at build time from the environment.
 *
 * The measurement ID is NOT confidential — it is served in the HTML of every
 * page, so anyone can read it with view-source. Sourcing it from the
 * environment instead of hardcoding it buys two things that do matter:
 *
 *   1. Forks don't inherit it. A fork that builds and deploys this site would
 *      otherwise report into our property and corrupt the numbers.
 *   2. Local and PR builds send nothing, because the variable is unset there.
 *      Analytics only exist on the real deploy.
 *
 * Set GA_MEASUREMENT_ID in the workflow from a repository secret.
 */
const gaId = process.env.GA_MEASUREMENT_ID;

const analyticsHead: HeadConfig[] = gaId
  ? [
      ['script', { async: '', src: `https://www.googletagmanager.com/gtag/js?id=${gaId}` }],
      [
        'script',
        {},
        `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`
      ]
    ]
  : [];

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
    ['meta', { property: 'og:image', content: 'https://cwins.github.io/stewie-js/stewie-logo.png' }],
    ...analyticsHead
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
