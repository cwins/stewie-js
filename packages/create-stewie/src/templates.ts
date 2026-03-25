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
    '@stewie-js/core': '^0.1.0',
    '@stewie-js/vite': '^0.1.0',
  }
  if (ctx.mode === 'ssr') {
    dependencies['@stewie-js/server'] = '^0.1.0'
    if (ctx.ssrRuntime === 'bun') {
      dependencies['@stewie-js/adapter-bun'] = '^0.1.0'
    } else {
      dependencies['@stewie-js/adapter-node'] = '^0.1.0'
    }
  }
  if (ctx.includeRouter) {
    dependencies['@stewie-js/router'] = '^0.1.0'
  }

  const devDependencies: Record<string, string> = {
    typescript: '^5.8.0',
    vite: '^6.0.0',
    vitest: '^3.0.0',
    '@stewie-js/testing': '^0.1.0',
  }
  if (ctx.mode === 'ssr' && ctx.ssrRuntime !== 'bun') {
    devDependencies['tsx'] = '^4.0.0'
  }

  const scripts: Record<string, string> = {
    dev: ctx.mode === 'ssr'
      ? (ctx.ssrRuntime === 'bun' ? 'bun src/server.ts' : 'tsx src/server.ts')
      : 'vite',
    build: ctx.mode === 'ssr' ? 'vite build && vite build --ssr' : 'vite build',
    test: 'vitest run',
  }
  if (ctx.mode === 'ssr') {
    scripts['start'] = ctx.ssrRuntime === 'bun'
      ? 'NODE_ENV=production bun dist/server/server.js'
      : 'NODE_ENV=production node dist/server/server.js'
  } else {
    scripts['preview'] = 'vite preview'
  }

  const packageJson = {
    name: ctx.projectName,
    version: '0.1.0',
    type: 'module',
    scripts,
    dependencies,
    devDependencies,
  }
  files.push({ path: 'package.json', content: JSON.stringify(packageJson, null, 2) + '\n' })

  // vite.config.ts
  if (ctx.mode === 'ssr') {
    files.push({
      path: 'vite.config.ts',
      content: `import { stewie, defineConfig } from '@stewie-js/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [stewie()],
  environments: {
    client: {
      build: {
        outDir: resolve(__dirname, 'dist/client'),
        emptyOutDir: true,
        rollupOptions: {
          input: 'index.html',
        },
      },
    },
    ssr: {
      build: {
        outDir: resolve(__dirname, 'dist/server'),
        emptyOutDir: true,
        rollupOptions: {
          input: 'src/server.ts',
          output: {
            format: 'esm',
            entryFileNames: '[name].js',
          },
        },
      },
    },
  },
})
`,
    })
  } else {
    files.push({
      path: 'vite.config.ts',
      content: `import { stewie, defineConfig } from '@stewie-js/vite'

export default defineConfig({
  plugins: [stewie()]
})
`,
    })
  }

  // tsconfig.json
  const tsconfig = {
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      jsxImportSource: '@stewie-js/core',
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
  const clientEntry = ctx.mode === 'ssr' ? '/src/client.tsx' : '/src/main.tsx'
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
    <div id="app">${ctx.mode === 'ssr' ? '<!--ssr-outlet-->' : ''}</div>
    <script type="module" src="${clientEntry}"></script>
  </body>
</html>
`,
  })

  // Client entry
  if (ctx.mode === 'ssr') {
    // SSR: client.tsx hydrates server-rendered HTML
    files.push({
      path: 'src/client.tsx',
      content: `import { hydrate } from '@stewie-js/core'
import App from './App.js'

hydrate(<App />, document.getElementById('app')!)
`,
    })
  } else {
    // Static: main.tsx mounts fresh
    files.push({
      path: 'src/main.tsx',
      content: `import { mount } from '@stewie-js/core'
import App from './App.js'

mount(<App />, document.getElementById('app')!)
`,
    })
  }

  // src/App.tsx
  if (ctx.includeRouter) {
    files.push({
      path: 'src/App.tsx',
      content: `import { Router, Route } from '@stewie-js/router'
import styles from './App.module.css'

function Home() {
  return <div class={styles.app}><h1>Home</h1></div>
}

function About() {
  return <div class={styles.app}><h1>About</h1></div>
}

export default function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
    </Router>
  )
}
`,
    })
  } else {
    files.push({
      path: 'src/App.tsx',
      content: `import styles from './App.module.css'

export default function App() {
  return (
    <div class={styles.app}>
      <h1>Welcome to ${ctx.projectName}!</h1>
      <p>Edit src/App.tsx to get started.</p>
    </div>
  )
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
        content: `import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToString } from '@stewie-js/server'
import { createBunHandler } from '@stewie-js/adapter-bun'
import App from './App.js'
import { jsx } from '@stewie-js/core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const PORT = parseInt(process.env.PORT ?? '3000', 10)

const template = readFileSync(resolve(root, 'dist/client/index.html'), 'utf-8')

const fetch = createBunHandler(async (_req) => {
  const { html, stateScript } = await renderToString(jsx(App, {}))
  const page = template
    .replace('<!--ssr-outlet-->', html)
    .replace('</body>', \`  \${stateScript}\\n  </body>\`)
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } })
})

export default { fetch, port: PORT }
`,
      })
    } else {
      files.push({
        path: 'src/server.ts',
        content: `import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToString } from '@stewie-js/server'
import { createNodeHandler } from '@stewie-js/adapter-node'
import App from './App.js'
import { jsx } from '@stewie-js/core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const PORT = parseInt(process.env.PORT ?? '3000', 10)

const template = readFileSync(resolve(root, 'dist/client/index.html'), 'utf-8')

const handler = createNodeHandler(async (_req) => {
  const { html, stateScript } = await renderToString(jsx(App, {}))
  const page = template
    .replace('<!--ssr-outlet-->', html)
    .replace('</body>', \`  \${stateScript}\\n  </body>\`)
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } })
})

createServer(handler).listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`)
})
`,
      })
    }
  }

  return files
}
