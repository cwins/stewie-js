export interface TemplateContext {
  projectName: string
  mode: 'static' | 'ssr'
  ssrRuntime?: 'node' | 'bun'
  includeRouter: boolean
}

export function generateFiles(ctx: TemplateContext): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = []

  // package.json
  const dependencies: Record<string, string> = {
    '@stewie/core': '^0.0.1',
    '@stewie/vite': '^0.0.1',
  }
  if (ctx.mode === 'ssr') {
    dependencies['@stewie/server'] = '^0.0.1'
    if (ctx.ssrRuntime === 'bun') {
      dependencies['@stewie/adapter-bun'] = '^0.0.1'
    } else {
      dependencies['@stewie/adapter-node'] = '^0.0.1'
    }
  }
  if (ctx.includeRouter) {
    dependencies['@stewie/router'] = '^0.0.1'
  }

  const packageJson = {
    name: ctx.projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      test: 'vitest run',
    },
    dependencies,
    devDependencies: {
      typescript: '^5.8.0',
      vite: '^6.0.0',
      vitest: '^3.0.0',
      '@stewie/testing': '^0.0.1',
    },
  }
  files.push({ path: 'package.json', content: JSON.stringify(packageJson, null, 2) + '\n' })

  // vite.config.ts
  files.push({
    path: 'vite.config.ts',
    content: `import { stewie, defineConfig } from '@stewie/vite'

export default defineConfig({
  plugins: [stewie()]
})
`,
  })

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      jsxImportSource: '@stewie/core',
      esModuleInterop: true,
      skipLibCheck: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    },
    include: ['src'],
  }
  files.push({ path: 'tsconfig.json', content: JSON.stringify(tsconfig, null, 2) + '\n' })

  // vitest.config.ts
  files.push({
    path: 'vitest.config.ts',
    content: `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
`,
  })

  // index.html
  files.push({
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${ctx.projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  })

  // src/main.tsx
  files.push({
    path: 'src/main.tsx',
    content: `import { jsx } from '@stewie/core'
import App from './App.js'

// Mount the app
const app = document.getElementById('app')!
// TODO: implement mount for client-side rendering
`,
  })

  // src/App.tsx
  if (ctx.includeRouter) {
    files.push({
      path: 'src/App.tsx',
      content: `import { jsx, Fragment } from '@stewie/core'
import { Router, Route } from '@stewie/router'
import styles from './App.module.css'

function Home() {
  return jsx('div', { children: jsx('h1', { children: 'Home' }) })
}

function About() {
  return jsx('div', { children: jsx('h1', { children: 'About' }) })
}

export default function App() {
  return Router({
    children: jsx(Fragment, { children: [
      Route({ path: '/', component: Home }),
      Route({ path: '/about', component: About }),
    ]})
  })
}
`,
    })
  } else {
    files.push({
      path: 'src/App.tsx',
      content: `import { jsx } from '@stewie/core'
import styles from './App.module.css'

export default function App() {
  return jsx('div', { class: styles.app, children: [
    jsx('h1', { children: 'Welcome to Stewie!' }),
    jsx('p', { children: 'Edit src/App.tsx to get started.' }),
  ]})
}
`,
    })
  }

  // src/App.module.css
  files.push({
    path: 'src/App.module.css',
    content: `.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, sans-serif;
}
`,
  })

  // src/server.ts (SSR only)
  if (ctx.mode === 'ssr') {
    if (ctx.ssrRuntime === 'bun') {
      files.push({
        path: 'src/server.ts',
        content: `import { renderToString } from '@stewie/server'
import { createBunHandler } from '@stewie/adapter-bun'
import App from './App.js'
import { jsx } from '@stewie/core'

const handler = createBunHandler(async (_req: Request) => {
  const html = await renderToString(jsx(App, {}))
  return new Response(html, { headers: { 'content-type': 'text/html' } })
})

export default handler
`,
      })
    } else {
      files.push({
        path: 'src/server.ts',
        content: `import { renderToString } from '@stewie/server'
import { createNodeHandler } from '@stewie/adapter-node'
import { createServer } from 'node:http'
import App from './App.js'
import { jsx } from '@stewie/core'

const handler = createNodeHandler(async (_req) => {
  const html = await renderToString(jsx(App, {}))
  return new Response(html, { headers: { 'content-type': 'text/html' } })
})

const server = createServer(handler)
server.listen(3000, () => console.log('Server running at http://localhost:3000'))
`,
      })
    }
  }

  return files
}
