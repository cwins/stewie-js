export interface TemplateContext {
  projectName: string;
  mode: 'static' | 'ssr';
  ssrRuntime?: 'node' | 'bun';
  includeRouter: boolean;
}

export function generateFiles(ctx: TemplateContext): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];

  // -------------------------------------------------------------------------
  // package.json
  // -------------------------------------------------------------------------

  const dependencies: Record<string, string> = {
    '@stewie-js/core': '^0.4.0',
    '@stewie-js/vite': '^0.4.0'
  };
  if (ctx.mode === 'ssr') {
    dependencies['@stewie-js/server'] = '^0.4.0';
    if (ctx.ssrRuntime === 'bun') {
      dependencies['@stewie-js/adapter-bun'] = '^0.4.0';
    } else {
      dependencies['@stewie-js/adapter-node'] = '^0.4.0';
    }
  }
  if (ctx.includeRouter) {
    dependencies['@stewie-js/router'] = '^0.4.0';
  }

  const devDependencies: Record<string, string> = {
    typescript: '^5.8.0',
    vite: '^7.0.0',
    vitest: '^4.0.0',
    '@stewie-js/testing': '^0.4.0',
    '@stewie-js/devtools': '^0.4.0'
  };
  if (ctx.mode === 'ssr' && ctx.ssrRuntime !== 'bun') {
    devDependencies['tsx'] = '^4.0.0';
  }

  const scripts: Record<string, string> = {
    dev: ctx.mode === 'ssr' ? (ctx.ssrRuntime === 'bun' ? 'bun src/server.ts' : 'tsx src/server.ts') : 'vite',
    build: ctx.mode === 'ssr' ? 'vite build && vite build --ssr' : 'vite build',
    test: 'vitest run'
  };
  if (ctx.mode === 'ssr') {
    scripts['start'] =
      ctx.ssrRuntime === 'bun'
        ? 'NODE_ENV=production bun dist/server/server.js'
        : 'NODE_ENV=production node dist/server/server.js';
  } else {
    scripts['preview'] = 'vite preview';
  }

  files.push({
    path: 'package.json',
    content:
      JSON.stringify(
        {
          name: ctx.projectName,
          version: '0.1.0',
          type: 'module',
          scripts,
          dependencies,
          devDependencies
        },
        null,
        2
      ) + '\n'
  });

  // -------------------------------------------------------------------------
  // vite.config.ts
  // -------------------------------------------------------------------------

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
        rollupOptions: { input: 'index.html' },
      },
    },
    ssr: {
      build: {
        outDir: resolve(__dirname, 'dist/server'),
        emptyOutDir: true,
        rollupOptions: {
          input: 'src/server.ts',
          output: { format: 'esm', entryFileNames: '[name].js' },
        },
      },
    },
  },
})
`
    });
  } else {
    files.push({
      path: 'vite.config.ts',
      content: `import { stewie, defineConfig } from '@stewie-js/vite'

export default defineConfig({
  plugins: [stewie()],
})
`
    });
  }

  // -------------------------------------------------------------------------
  // tsconfig.json
  // -------------------------------------------------------------------------

  files.push({
    path: 'tsconfig.json',
    content:
      JSON.stringify(
        {
          compilerOptions: {
            strict: true,
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            jsxImportSource: '@stewie-js/core',
            esModuleInterop: true,
            skipLibCheck: true,
            lib: ['ES2022', 'DOM', 'DOM.Iterable']
          },
          include: ['src']
        },
        null,
        2
      ) + '\n'
  });

  // -------------------------------------------------------------------------
  // vitest.config.ts
  // -------------------------------------------------------------------------

  files.push({
    path: 'vitest.config.ts',
    content: `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
`
  });

  // -------------------------------------------------------------------------
  // index.html
  // -------------------------------------------------------------------------

  const clientEntry = ctx.mode === 'ssr' ? '/src/client.tsx' : '/src/main.tsx';
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
`
  });

  // -------------------------------------------------------------------------
  // Client / SSR entry points
  // -------------------------------------------------------------------------

  if (ctx.mode === 'ssr') {
    files.push({
      path: 'src/client.tsx',
      content: `import { hydrate } from '@stewie-js/core'
import { App } from './app.js'

hydrate(<App />, document.getElementById('app')!)
`
    });

    // server.ts — dev mode uses Vite middleware; prod serves pre-built assets
    if (ctx.ssrRuntime === 'bun') {
      files.push({
        path: 'src/server.ts',
        content: `import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const isProd = process.env.NODE_ENV === 'production'
const PORT = parseInt(process.env.PORT ?? '3000', 10)

if (isProd) {
  const { createBunHandler } = await import('@stewie-js/adapter-bun')
  const { renderApp } = await import('./app.js')
  const template = readFileSync(resolve(root, 'dist/client/index.html'), 'utf-8')

  // Bun.serve() keeps the process alive and handles connections natively.
  ;(globalThis as any).Bun.serve(createBunHandler(async (req: Request) => {
    const url = new URL(req.url).pathname
    const { html, stateScript } = await renderApp(url)
    const page = template
      .replace('<!--ssr-outlet-->', html)
      .replace('</body>', \`  \${stateScript}\\n  </body>\`)
    return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }, { port: PORT }))
  console.log(\`Server running at http://localhost:\${PORT}\`)
} else {
  // Dev: Bun supports node:http, so Vite's middleware mode works here.
  const { createServer: createVite } = await import('vite')

  const vite = await createVite({ root, server: { middlewareMode: true }, appType: 'custom' })

  createServer((req, res) => {
    vite.middlewares(req, res, () => {
      ;(async () => {
        const { renderApp } = (await vite.ssrLoadModule('/src/app.tsx')) as {
          renderApp: (url: string) => Promise<{ html: string; stateScript: string }>
        }
        const rawTemplate = readFileSync(resolve(root, 'index.html'), 'utf-8')
        const template = await vite.transformIndexHtml(req.url ?? '/', rawTemplate)
        const { html, stateScript } = await renderApp(req.url ?? '/')
        const page = template
          .replace('<!--ssr-outlet-->', html)
          .replace('</body>', \`  \${stateScript}\\n  </body>\`)
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(page)
      })().catch((e) => {
        vite.ssrFixStacktrace(e as Error)
        res.writeHead(500)
        res.end(String(e))
      })
    })
  }).listen(PORT, () => {
    console.log(\`Dev server running at http://localhost:\${PORT}\`)
  })
}
`
      });
    } else {
      files.push({
        path: 'src/server.ts',
        content: `import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const isProd = process.env.NODE_ENV === 'production'
const PORT = parseInt(process.env.PORT ?? '3000', 10)

if (isProd) {
  const { renderApp } = await import('./app.js')
  const template = readFileSync(resolve(root, 'dist/client/index.html'), 'utf-8')

  createServer(async (req, res) => {
    const { html, stateScript } = await renderApp(req.url ?? '/')
    const page = template
      .replace('<!--ssr-outlet-->', html)
      .replace('</body>', \`  \${stateScript}\\n  </body>\`)
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(page)
  }).listen(PORT, () => {
    console.log(\`Server running at http://localhost:\${PORT}\`)
  })
} else {
  const { createServer: createVite } = await import('vite')

  const vite = await createVite({ root, server: { middlewareMode: true }, appType: 'custom' })

  createServer((req, res) => {
    vite.middlewares(req, res, () => {
      ;(async () => {
        const { renderApp } = (await vite.ssrLoadModule('/src/app.tsx')) as {
          renderApp: (url: string) => Promise<{ html: string; stateScript: string }>
        }
        const rawTemplate = readFileSync(resolve(root, 'index.html'), 'utf-8')
        const template = await vite.transformIndexHtml(req.url ?? '/', rawTemplate)
        const { html, stateScript } = await renderApp(req.url ?? '/')
        const page = template
          .replace('<!--ssr-outlet-->', html)
          .replace('</body>', \`  \${stateScript}\\n  </body>\`)
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(page)
      })().catch((e) => {
        vite.ssrFixStacktrace(e as Error)
        res.writeHead(500)
        res.end(String(e))
      })
    })
  }).listen(PORT, () => {
    console.log(\`Dev server running at http://localhost:\${PORT}\`)
  })
}
`
      });
    }
  } else {
    files.push({
      path: 'src/main.tsx',
      content: `import { mount } from '@stewie-js/core'
import { App } from './app.js'

mount(<App />, document.getElementById('app')!)
`
    });
  }

  // -------------------------------------------------------------------------
  // styles.css
  // -------------------------------------------------------------------------

  files.push({
    path: 'src/styles.css',
    content: `:root {
  --primary: #6366f1;
  --primary-hover: #818cf8;
  --bg: #f8fafc;
  --surface: #ffffff;
  --text: #0f172a;
  --text-muted: #64748b;
  --border: #e2e8f0;
  --radius: 10px;
}

* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; }

/* Layout */
.layout { display: flex; flex-direction: column; min-height: 100vh; }
.main { flex: 1; }
.page { max-width: 760px; margin: 0 auto; padding: 2.5rem 1.25rem; }

/* Nav */
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 1.25rem; height: 56px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 10;
}
.nav-brand { font-weight: 700; font-size: 1rem; color: var(--primary); letter-spacing: -0.01em; }
.nav-links { display: flex; gap: 0.25rem; }
.nav-link {
  padding: 0.375rem 0.75rem; border-radius: 6px;
  color: var(--text-muted); text-decoration: none; font-size: 0.9rem;
  transition: color 0.15s, background 0.15s;
}
.nav-link:hover { color: var(--text); background: var(--bg); }
.nav-link.active { color: var(--primary); background: #eef2ff; font-weight: 500; }

/* Hero */
.hero { margin-bottom: 2.5rem; }
.hero-title { font-size: 2rem; font-weight: 800; margin: 0 0 0.5rem; letter-spacing: -0.03em; }
.hero-title strong { color: var(--primary); }
.hero-subtitle { font-size: 1.05rem; color: var(--text-muted); margin: 0 0 1.25rem; }
.hero-actions { display: flex; gap: 0.625rem; flex-wrap: wrap; }

/* Sections */
.section { margin-bottom: 2rem; }
.section-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.25rem; }
.section-desc { color: var(--text-muted); font-size: 0.9rem; margin: 0 0 1rem; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.section-header .section-title { margin: 0; }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.5rem 1.125rem; border-radius: var(--radius);
  font-size: 0.9rem; font-weight: 500; cursor: pointer;
  border: none; transition: background 0.15s, color 0.15s, border-color 0.15s;
  text-decoration: none;
}
.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-hover); }
.btn-outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
.btn-outline:hover { border-color: var(--primary); color: var(--primary); }
.btn-ghost { background: transparent; color: var(--text-muted); border: 1px solid transparent; }
.btn-ghost:hover { background: var(--bg); color: var(--text); }
.btn-sm { padding: 0.3rem 0.75rem; font-size: 0.8rem; }

/* Card */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* Counter */
.counter-card { text-align: center; }
.counter-value { font-size: 4rem; font-weight: 800; line-height: 1; letter-spacing: -0.04em; color: var(--primary); margin-bottom: 0.375rem; }
.counter-meta { color: var(--text-muted); font-size: 0.875rem; margin-bottom: 1.25rem; }
.counter-controls { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.counter-controls .btn { min-width: 44px; font-size: 1.25rem; padding: 0.4rem 0.875rem; }

/* Todo list */
.todo-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.375rem; }
.todo-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  cursor: pointer; transition: border-color 0.15s;
}
.todo-item:hover { border-color: var(--primary); }
.todo-item.done .todo-text { text-decoration: line-through; opacity: 0.45; }
.todo-check { font-size: 1.1rem; flex-shrink: 0; color: var(--primary); width: 1.25rem; text-align: center; }
.todo-text { font-size: 0.9rem; }

/* Features list */
.features-list { list-style: none; margin: 1rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.features-list li {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.625rem 1rem; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius);
  font-size: 0.9rem;
}
.features-list li::before { content: '⚡'; flex-shrink: 0; }

/* Input */
.input {
  width: 100%; padding: 0.5rem 0.875rem; font-size: 0.9rem;
  background: var(--surface); color: var(--text);
  border: 1px solid var(--border); border-radius: var(--radius);
  outline: none; transition: border-color 0.15s;
}
.input:focus { border-color: var(--primary); }

/* Page subtitle */
.page-title { font-size: 1.75rem; font-weight: 700; margin: 0 0 0.375rem; letter-spacing: -0.02em; }
.page-subtitle { color: var(--text-muted); margin: 0 0 2rem; }
`
  });

  // -------------------------------------------------------------------------
  // src/app.tsx — main app component
  // -------------------------------------------------------------------------

  if (ctx.includeRouter) {
    const ssrExport =
      ctx.mode === 'ssr'
        ? `
import { renderToString } from '@stewie-js/server'
import type { RenderResult } from '@stewie-js/server'

export async function renderApp(url: string = '/'): Promise<RenderResult> {
  return renderToString(<App initialUrl={url} />)
}`
        : '';

    files.push({
      path: 'src/app.tsx',
      content: `import { Router, Route } from '@stewie-js/router'
import { lazy } from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'
import './styles.css'

// lazy() code-splits each page — the bundle for that page is only loaded
// when the user navigates to it for the first time.
const HomePage = lazy(() => import('./pages/home.js').then((m) => m.HomePage))
const CounterPage = lazy(() => import('./pages/counter.js').then((m) => m.CounterPage))
const AboutPage = lazy(() => import('./pages/about.js').then((m) => m.AboutPage))

// Router must have only <Route> elements as direct children —
// the Router scans them to build the route table.
// Layout (nav + wrapper) lives inside each page so it has RouterContext.
export function App({ initialUrl }: { initialUrl?: string } = {}): JSXElement {
  return (
    <Router initialUrl={initialUrl}>
      <Route path="/" component={HomePage} />
      <Route path="/counter" component={CounterPage} />
      <Route path="/about" component={AboutPage} />
    </Router>
  )
}
${ssrExport}`
    });
  } else {
    // No-router single-page app: signals + store + Show + For all in one place
    const ssrExport =
      ctx.mode === 'ssr'
        ? `
import { renderToString } from '@stewie-js/server'
import type { RenderResult } from '@stewie-js/server'

export async function renderApp(_url: string = '/'): Promise<RenderResult> {
  return renderToString(<App />)
}`
        : '';

    files.push({
      path: 'src/app.tsx',
      content: `import { signal, store, computed, batch, createRoot, resource } from '@stewie-js/core'
import { Show, For, Switch, Match } from '@stewie-js/core'
import type { Resource, JSXElement } from '@stewie-js/core'
import './styles.css'

interface TodoItem {
  id: number
  text: string
  done: boolean
}

// Simulated async data load — replace with fetch('/api/...').then(r => r.json())
async function loadWelcomeTip(): Promise<{ tip: string }> {
  await new Promise<void>((r) => setTimeout(r, 600))
  return { tip: 'Only the DOM nodes that changed are updated — no virtual DOM diffing.' }
}

export function App(): JSXElement {
  let count!: ReturnType<typeof signal<number>>
  let doubled!: ReturnType<typeof computed<number>>
  let resets!: ReturnType<typeof signal<number>>
  let showTodos!: ReturnType<typeof signal<boolean>>
  let filter!: ReturnType<typeof signal<string>>
  let todos!: TodoItem[]
  let tipResource!: Resource<{ tip: string }>
  createRoot(() => {
    count = signal(0)
    doubled = computed(() => count() * 2)
    resets = signal(0)
    showTodos = signal(true)
    filter = signal('')
    todos = store([
      { id: 1, text: 'Learn Stewie signals', done: false },
      { id: 2, text: 'Try fine-grained reactivity', done: false },
      { id: 3, text: 'Build something great', done: false },
    ])
    // resource() wraps any async function — exposes .loading, .data, .error signals
    tipResource = resource(loadWelcomeTip)
  })

  return (
    <div class="layout">
      <header class="nav">
        <span class="nav-brand">${ctx.projectName}</span>
      </header>
      <main class="main">
        <div class="page">

          <div class="hero">
            <h1 class="hero-title">Welcome to <strong>${ctx.projectName}</strong></h1>
            <p class="hero-subtitle">
              Built with Stewie — fine-grained signal-based reactivity, no virtual DOM.
            </p>
          </div>

          <div class="section">
            <h2 class="section-title">Async data</h2>
            <p class="section-desc">
              resource() wraps any async function with reactive loading, data, and error signals.
            </p>
            {/* resource() — show fallback while loading, content once resolved */}
            <div class="card">
              <Show
                when={() => !tipResource.loading()}
                fallback={<p class="section-desc">Loading…</p>}
              >
                <p>{() => tipResource.data()?.tip ?? ''}</p>
              </Show>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Counter</h2>
            <p class="section-desc">
              Signals update only the exact DOM nodes that depend on them.
            </p>
            <div class="card counter-card">
              <div class="counter-value">{() => count()}</div>
              <div class="counter-meta">
                {/* Switch/Match: only the first matching branch is mounted in the DOM */}
                <Switch>
                  <Match when={() => count() < 0}><span>negative · </span></Match>
                  <Match when={() => count() === 0}><span>zero · </span></Match>
                  <Match when={() => count() > 0}><span>positive · </span></Match>
                </Switch>
                <span>{() => \`doubled: \${doubled()}\`}</span>
              </div>
              <div class="counter-controls">
                <button class="btn btn-outline" onClick={() => count.update((n) => n - 1)}>−</button>
                {/* batch() groups two signal writes into one notification pass */}
                <button class="btn btn-ghost" onClick={() => batch(() => { count.set(0); resets.update((n) => n + 1) })}>Reset</button>
                <button class="btn btn-primary" onClick={() => count.update((n) => n + 1)}>+</button>
              </div>
              <Show when={() => resets() > 0}>
                <p class="counter-meta">{() => \`Reset \${resets()} \${resets() === 1 ? 'time' : 'times'}\`}</p>
              </Show>
            </div>
          </div>

          <div class="section">
            <div class="section-header">
              <h2 class="section-title">Todo list</h2>
              {/* The compiler auto-wraps signal reads in JSX — no () => needed here */}
              <button class="btn btn-sm btn-outline" onClick={() => showTodos.update((v) => !v)}>
                {showTodos() ? 'Hide' : 'Show'}
              </button>
            </div>
            <p class="section-desc">
              Store Proxy — clicking an item updates only that row, not the whole list.
            </p>
            <Show when={showTodos}>
              {/* $value creates a two-way binding — no onChange handler needed */}
              <input $value={filter} placeholder="Filter todos…" class="input" style="margin-bottom:0.75rem" />
              <ul class="todo-list">
                <For
                  each={() => todos.filter((t: TodoItem) =>
                    t.text.toLowerCase().includes(filter().toLowerCase())
                  )}
                  key={(item: TodoItem) => item.id}
                >
                  {(getItem: () => TodoItem) => (
                    <li
                      class={() => \`todo-item\${getItem().done ? ' done' : ''}\`}
                      onClick={() => { getItem().done = !getItem().done }}
                    >
                      <span class="todo-check">{() => (getItem().done ? '✓' : '○')}</span>
                      <span class="todo-text">{() => getItem().text}</span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>

        </div>
      </main>
    </div>
  )
}
${ssrExport}`
    });
  }

  // -------------------------------------------------------------------------
  // src/nav.tsx (router only)
  // -------------------------------------------------------------------------

  if (ctx.includeRouter) {
    files.push({
      path: 'src/nav.tsx',
      content: `import { useRouter } from '@stewie-js/router'
import type { JSXElement } from '@stewie-js/core'

// NavLink highlights itself when its path matches the current URL.
// The class prop is a reactive function so only that attribute re-runs —
// no component re-render needed.
function NavLink({ to, children }: { to: string; children: string }): JSXElement {
  const router = useRouter()
  return (
    <a
      href={to}
      class={() => \`nav-link\${router.location.pathname === to ? ' active' : ''}\`}
      onClick={(e: Event) => {
        e.preventDefault()
        router.navigate(to)
      }}
    >
      {children}
    </a>
  )
}

export function Nav({ title }: { title: string }): JSXElement {
  return (
    <header class="nav">
      <span class="nav-brand">{title}</span>
      <nav class="nav-links">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/counter">Counter</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
    </header>
  )
}
`
    });

    // -----------------------------------------------------------------------
    // src/shell.tsx — layout wrapper used by every page
    // -----------------------------------------------------------------------

    files.push({
      path: 'src/shell.tsx',
      content: `import { Nav } from './nav.js'
import type { JSXElement } from '@stewie-js/core'

// Shell wraps each page with the persistent nav + main container.
// It is rendered *inside* RouterContext (as part of a matched route component),
// so Nav can safely call useRouter() for the active-link highlighting.
export function Shell({ children }: { children: JSXElement }): JSXElement {
  return (
    <div class="layout">
      <Nav title="${ctx.projectName}" />
      <main class="main">
        {children}
      </main>
    </div>
  )
}
`
    });

    // -----------------------------------------------------------------------
    // src/pages/home.tsx
    // -----------------------------------------------------------------------

    files.push({
      path: 'src/pages/home.tsx',
      content: `import { signal, createRoot, Show, For, resource } from '@stewie-js/core'
import type { Resource, JSXElement } from '@stewie-js/core'
import { useRouter } from '@stewie-js/router'
import { Shell } from '../shell.js'

// Simulated async data load — in a real app replace with fetch('/api/...').then(r => r.json())
async function loadWelcomeTip(): Promise<{ tip: string }> {
  await new Promise<void>((r) => setTimeout(r, 600))
  return { tip: 'Only the DOM nodes that changed are updated — no virtual DOM diffing.' }
}

const FEATURES = [
  'Signal-based reactivity — no virtual DOM',
  'Fine-grained DOM updates (only what changed)',
  'Server-side rendering with hydration',
  'TypeScript-first with full type inference',
  'Tiny runtime, zero dependencies',
]

export function HomePage(): JSXElement {
  const router = useRouter()

  let showFeatures!: ReturnType<typeof signal<boolean>>
  let tipResource!: Resource<{ tip: string }>
  createRoot(() => {
    showFeatures = signal(false)
    // resource() wraps any async function — exposes .loading, .data, .error signals
    tipResource = resource(loadWelcomeTip)
  })

  return (
    <Shell>
      <div class="page">
        <div class="hero">
          <h1 class="hero-title">Hello from <strong>Stewie</strong></h1>
          <p class="hero-subtitle">
            Fine-grained signal-based reactivity. No virtual DOM. SSR built-in.
          </p>
          <div class="hero-actions">
            <button class="btn btn-primary" onClick={() => router.navigate('/counter')}>
              Try the counter →
            </button>
            {/* The compiler auto-wraps signal reads in JSX — no () => needed */}
            <button class="btn btn-outline" onClick={() => showFeatures.update((v) => !v)}>
              {showFeatures() ? 'Hide features' : 'What makes it fast?'}
            </button>
          </div>
        </div>

        {/* resource() — reactive loading/data/error signals for async operations */}
        <div class="section">
          <h2 class="section-title">Async data</h2>
          <div class="card">
            <Show
              when={() => !tipResource.loading()}
              fallback={<p class="section-desc">Loading…</p>}
            >
              <p>{() => tipResource.data()?.tip ?? ''}</p>
            </Show>
          </div>
        </div>

        <Show when={showFeatures}>
          <ul class="features-list">
            <For each={FEATURES}>
              {(getFeature: () => string) => <li>{() => getFeature()}</li>}
            </For>
          </ul>
        </Show>
      </div>
    </Shell>
  )
}
`
    });

    // -----------------------------------------------------------------------
    // src/pages/counter.tsx
    // -----------------------------------------------------------------------

    files.push({
      path: 'src/pages/counter.tsx',
      content: `import { signal, computed, batch, createRoot, Show, Switch, Match } from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'
import { Shell } from '../shell.js'

export function CounterPage(): JSXElement {
  let count!: ReturnType<typeof signal<number>>
  let doubled!: ReturnType<typeof computed<number>>
  let resets!: ReturnType<typeof signal<number>>
  createRoot(() => {
    count = signal(0)
    doubled = computed(() => count() * 2)
    resets = signal(0)
  })

  return (
    <Shell>
      <div class="page">
        <h1 class="page-title">Counter</h1>
        <p class="page-subtitle">
          Signals update only the exact DOM nodes that depend on them —
          no component re-render, no diffing.
        </p>

        <div class="card counter-card">
          <div class="counter-value">{() => count()}</div>
          <div class="counter-meta">
            {/* Switch/Match: only the first matching branch is mounted in the DOM */}
            <Switch>
              <Match when={() => count() < 0}><span>negative · </span></Match>
              <Match when={() => count() === 0}><span>zero · </span></Match>
              <Match when={() => count() > 0}><span>positive · </span></Match>
            </Switch>
            <span>{() => \`doubled: \${doubled()}\`}</span>
          </div>
          <div class="counter-controls">
            <button class="btn btn-outline" onClick={() => count.update((n) => n - 1)}>−</button>
            {/* batch() groups two signal writes into one notification pass */}
            <button class="btn btn-ghost" onClick={() => batch(() => { count.set(0); resets.update((n) => n + 1) })}>Reset</button>
            <button class="btn btn-primary" onClick={() => count.update((n) => n + 1)}>+</button>
          </div>
          <Show when={() => resets() > 0}>
            <p class="counter-meta">{() => \`Reset \${resets()} \${resets() === 1 ? 'time' : 'times'}\`}</p>
          </Show>
        </div>
      </div>
    </Shell>
  )
}
`
    });

    // -----------------------------------------------------------------------
    // src/pages/about.tsx
    // -----------------------------------------------------------------------

    files.push({
      path: 'src/pages/about.tsx',
      content: `import { For } from '@stewie-js/core'
import type { JSXElement } from '@stewie-js/core'
import { Shell } from '../shell.js'

const PRIMITIVES = [
  { name: 'signal(value)', desc: 'Reactive value — read with sig(), write with sig.set()' },
  { name: 'sig.peek()', desc: 'Read current value without registering a subscription' },
  { name: 'computed(fn)', desc: 'Derived value — lazy, memoized, auto-tracked' },
  { name: 'effect(fn)', desc: 'Side effect — re-runs when any accessed signal changes' },
  { name: 'store(object)', desc: 'Reactive object — path-level subscriptions via Proxy' },
]

export function AboutPage(): JSXElement {
  return (
    <Shell>
      <div class="page">
        <h1 class="page-title">About</h1>
        <p class="page-subtitle">
          Stewie is a TypeScript web framework with fine-grained signal-based reactivity
          and no virtual DOM. This app was scaffolded with <code>create-stewie</code>.
        </p>

        <div class="section">
          <h2 class="section-title">Core primitives</h2>
          <p class="section-desc">Everything reactive builds on these four primitives.</p>
          <ul class="features-list">
            <For each={PRIMITIVES}>
              {(getP: () => typeof PRIMITIVES[number]) => (
                <li>
                  <span>
                    <strong>{() => getP().name}</strong>
                    {' — '}
                    {() => getP().desc}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>
    </Shell>
  )
}
`
    });
  }

  return files;
}
