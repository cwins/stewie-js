import { describe, it, expect } from 'vitest'
import { generateFiles } from './templates.js'

describe('generateFiles — static mode (no router)', () => {
  it('generates required files', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('package.json')
    expect(paths).toContain('vite.config.ts')
    expect(paths).toContain('tsconfig.json')
    expect(paths).toContain('vitest.config.ts')
    expect(paths).toContain('index.html')
    expect(paths).toContain('src/main.tsx')
    expect(paths).toContain('src/app.tsx')
    expect(paths).toContain('src/styles.css')
  })

  it('does not include router-only files', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const paths = files.map((f) => f.path)
    expect(paths).not.toContain('src/nav.tsx')
    expect(paths).not.toContain('src/pages/home.tsx')
    expect(paths).not.toContain('src/pages/counter.tsx')
    expect(paths).not.toContain('src/pages/about.tsx')
    expect(paths).not.toContain('src/server.ts')
  })

  it('main.tsx uses mount()', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const main = files.find((f) => f.path === 'src/main.tsx')!
    expect(main.content).toContain("import { mount } from '@stewie-js/core'")
    expect(main.content).toContain('mount(<App />')
  })

  it('main.tsx imports from app.js (lowercase)', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const main = files.find((f) => f.path === 'src/main.tsx')!
    expect(main.content).toContain("from './app.js'")
  })

  it('index.html references /src/main.tsx', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const html = files.find((f) => f.path === 'index.html')!
    expect(html.content).toContain('src/main.tsx')
  })

  it('index.html contains project name in title', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const html = files.find((f) => f.path === 'index.html')!
    expect(html.content).toContain('<title>my-app</title>')
  })

  it('app.tsx uses signals and store', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const app = files.find((f) => f.path === 'src/app.tsx')!
    expect(app.content).toContain('signal(')
    expect(app.content).toContain('store(')
    expect(app.content).toContain('<Show')
    expect(app.content).toContain('<For')
    expect(app.content).toContain('<h1')
  })

  it('app.tsx demonstrates $value two-way binding for filter input', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const app = files.find((f) => f.path === 'src/app.tsx')!
    expect(app.content).toContain('filter = signal(')
    expect(app.content).toContain('$value={filter}')
  })

  it('app.tsx uses compiler auto-wrap (no explicit () => for signal ternary)', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const app = files.find((f) => f.path === 'src/app.tsx')!
    // The show/hide button text uses the signal directly — compiler wraps it
    expect(app.content).toContain("{showTodos() ? 'Hide' : 'Show'}")
    expect(app.content).not.toContain("{() => (showTodos() ? 'Hide' : 'Show')}")
  })

  it('styles.css includes .input class', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const css = files.find((f) => f.path === 'src/styles.css')!
    expect(css.content).toContain('.input')
  })

  it('includes @stewie-js/devtools in devDependencies', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const pkgJson = JSON.parse(files.find((f) => f.path === 'package.json')!.content)
    expect(pkgJson.devDependencies).toHaveProperty('@stewie-js/devtools')
  })

  it('vitest.config.ts uses happy-dom environment', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const vitest = files.find((f) => f.path === 'vitest.config.ts')!
    expect(vitest.content).toContain("environment: 'happy-dom'")
  })

  it('sets correct project name in package.json', () => {
    const files = generateFiles({ projectName: 'awesome-project', mode: 'static', includeRouter: false })
    const pkgJson = files.find((f) => f.path === 'package.json')!
    expect(JSON.parse(pkgJson.content).name).toBe('awesome-project')
  })

  it('includes router dep when includeRouter is true', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const pkgJson = files.find((f) => f.path === 'package.json')!
    expect(pkgJson.content).toContain('@stewie-js/router')
  })
})

describe('generateFiles — static mode (with router)', () => {
  it('generates app.tsx, nav.tsx, shell.tsx, and page files', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('src/app.tsx')
    expect(paths).toContain('src/nav.tsx')
    expect(paths).toContain('src/shell.tsx')
    expect(paths).toContain('src/pages/home.tsx')
    expect(paths).toContain('src/pages/counter.tsx')
    expect(paths).toContain('src/pages/about.tsx')
    expect(paths).toContain('src/styles.css')
  })

  it('app.tsx has Router with ONLY direct Route children (no other elements)', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const app = files.find((f) => f.path === 'src/app.tsx')!
    expect(app.content).toContain('<Router')
    expect(app.content).toContain('path="/"')
    expect(app.content).toContain('path="/counter"')
    expect(app.content).toContain('path="/about"')
    // Nav must NOT be in app.tsx — it belongs in shell.tsx
    expect(app.content).not.toContain('<Nav')
    // No wrapper elements inside Router
    expect(app.content).not.toContain('<main')
  })

  it('shell.tsx renders Nav and wraps children in main', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const shell = files.find((f) => f.path === 'src/shell.tsx')!
    expect(shell.content).toContain('<Nav')
    expect(shell.content).toContain('<main')
    expect(shell.content).toContain('{children}')
    expect(shell.content).toContain("from './nav.js'")
  })

  it('nav.tsx has reactive NavLink with active class', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const nav = files.find((f) => f.path === 'src/nav.tsx')!
    expect(nav.content).toContain('useRouter')
    expect(nav.content).toContain('active')
    // class should be a reactive function prop
    expect(nav.content).toContain('class={() =>')
  })

  it('pages/home.tsx uses Show and For, wrapped in Shell', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const home = files.find((f) => f.path === 'src/pages/home.tsx')!
    expect(home.content).toContain('<Show')
    expect(home.content).toContain('<For')
    expect(home.content).toContain('signal(')
    expect(home.content).toContain('<Shell>')
    expect(home.content).toContain("from '../shell.js'")
  })

  it('pages/home.tsx imports are at the top (no bottom imports)', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const home = files.find((f) => f.path === 'src/pages/home.tsx')!
    const lines = home.content.split('\n')
    const lastImportLine = lines.reduce((last, line, i) => line.startsWith('import ') ? i : last, -1)
    const firstNonImportNonBlank = lines.findIndex((line, i) => i > 0 && line.trim() && !line.startsWith('import '))
    // All imports come before non-import code
    expect(lastImportLine).toBeLessThan(firstNonImportNonBlank + 5)
  })

  it('pages/counter.tsx uses signal and computed, wrapped in Shell', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const counter = files.find((f) => f.path === 'src/pages/counter.tsx')!
    expect(counter.content).toContain('signal(')
    expect(counter.content).toContain('computed(')
    expect(counter.content).toContain('CounterPage')
    expect(counter.content).toContain('<Shell>')
    expect(counter.content).toContain("from '../shell.js'")
  })

  it('pages/about.tsx uses For, wrapped in Shell', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const about = files.find((f) => f.path === 'src/pages/about.tsx')!
    expect(about.content).toContain('<For')
    expect(about.content).toContain('AboutPage')
    expect(about.content).toContain('<Shell>')
    expect(about.content).toContain("from '../shell.js'")
  })

  it('pages/about.tsx includes signal.peek() in primitives list', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const about = files.find((f) => f.path === 'src/pages/about.tsx')!
    expect(about.content).toContain('peek()')
  })

  it('app.tsx uses lazy() for page imports', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const app = files.find((f) => f.path === 'src/app.tsx')!
    expect(app.content).toContain("import { lazy } from '@stewie-js/core'")
    expect(app.content).toContain('lazy(() => import(')
    // Should not use static imports for page components
    expect(app.content).not.toContain("import { HomePage }")
    expect(app.content).not.toContain("import { CounterPage }")
    expect(app.content).not.toContain("import { AboutPage }")
  })

  it('pages/home.tsx uses compiler auto-wrap (no explicit () => for showFeatures ternary)', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: true })
    const home = files.find((f) => f.path === 'src/pages/home.tsx')!
    expect(home.content).toContain("{showFeatures() ? 'Hide features' : 'What makes it fast?'}")
    expect(home.content).not.toContain("{() => (showFeatures()")
  })
})

describe('generateFiles — SSR mode (node)', () => {
  it('generates required files', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('package.json')
    expect(paths).toContain('vite.config.ts')
    expect(paths).toContain('src/client.tsx')
    expect(paths).toContain('src/server.ts')
    expect(paths).toContain('src/app.tsx')
    expect(paths).toContain('src/styles.css')
  })

  it('generates client.tsx (not main.tsx) for SSR mode', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('src/client.tsx')
    expect(paths).not.toContain('src/main.tsx')
  })

  it('client.tsx uses hydrate()', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const client = files.find((f) => f.path === 'src/client.tsx')!
    expect(client.content).toContain("import { hydrate } from '@stewie-js/core'")
    expect(client.content).toContain('hydrate(<App />')
  })

  it('client.tsx imports from app.js (lowercase)', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const client = files.find((f) => f.path === 'src/client.tsx')!
    expect(client.content).toContain("from './app.js'")
  })

  it('index.html references /src/client.tsx and has ssr-outlet', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const html = files.find((f) => f.path === 'index.html')!
    expect(html.content).toContain('src/client.tsx')
    expect(html.content).toContain('<!--ssr-outlet-->')
  })

  it('server.ts uses createServer from node:http', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const server = files.find((f) => f.path === 'src/server.ts')!
    expect(server.content).toContain("from 'node:http'")
    expect(server.content).toContain('createServer')
  })

  it('server.ts has dev/prod split with Vite middleware in dev', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const server = files.find((f) => f.path === 'src/server.ts')!
    expect(server.content).toContain('isProd')
    expect(server.content).toContain('vite.middlewares')
    expect(server.content).toContain('ssrLoadModule')
  })

  it('server.ts destructures { html, stateScript } from renderToString', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const server = files.find((f) => f.path === 'src/server.ts')!
    expect(server.content).toContain('{ html, stateScript }')
    expect(server.content).toContain('stateScript')
    expect(server.content).toContain('</body>')
  })

  it('package.json includes tsx in devDependencies', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const pkgJson = JSON.parse(files.find((f) => f.path === 'package.json')!.content)
    expect(pkgJson.devDependencies).toHaveProperty('tsx')
  })

  it('package.json includes start script', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const pkgJson = JSON.parse(files.find((f) => f.path === 'package.json')!.content)
    expect(pkgJson.scripts).toHaveProperty('start')
  })

  it('vite.config.ts includes SSR environment config', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const vite = files.find((f) => f.path === 'vite.config.ts')!
    expect(vite.content).toContain('environments')
    expect(vite.content).toContain("input: 'src/server.ts'")
  })

  it('SSR with router generates nav, shell, and page files', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: true })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('src/nav.tsx')
    expect(paths).toContain('src/shell.tsx')
    expect(paths).toContain('src/pages/home.tsx')
    expect(paths).toContain('src/pages/counter.tsx')
    expect(paths).toContain('src/pages/about.tsx')
  })
})

describe('generateFiles — SSR mode (bun)', () => {
  it('generates server.ts with createBunHandler', () => {
    const files = generateFiles({ projectName: 'bun-app', mode: 'ssr', ssrRuntime: 'bun', includeRouter: false })
    const server = files.find((f) => f.path === 'src/server.ts')!
    expect(server.content).toContain('createBunHandler')
  })

  it('server.ts destructures { html, stateScript } from renderToString', () => {
    const files = generateFiles({ projectName: 'bun-app', mode: 'ssr', ssrRuntime: 'bun', includeRouter: false })
    const server = files.find((f) => f.path === 'src/server.ts')!
    expect(server.content).toContain('{ html, stateScript }')
  })

  it('package.json does not include tsx for bun', () => {
    const files = generateFiles({ projectName: 'bun-app', mode: 'ssr', ssrRuntime: 'bun', includeRouter: false })
    const pkgJson = JSON.parse(files.find((f) => f.path === 'package.json')!.content)
    expect(pkgJson.devDependencies).not.toHaveProperty('tsx')
  })
})
