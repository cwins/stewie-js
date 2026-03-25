import { describe, it, expect } from 'vitest'
import { generateFiles } from './templates.js'

describe('generateFiles — static mode', () => {
  it('generates required files', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('package.json')
    expect(paths).toContain('vite.config.ts')
    expect(paths).toContain('tsconfig.json')
    expect(paths).toContain('index.html')
    expect(paths).toContain('src/main.tsx')
    expect(paths).toContain('src/App.tsx')
    expect(paths).toContain('src/App.module.css')
  })

  it('main.tsx uses mount()', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const main = files.find((f) => f.path === 'src/main.tsx')!
    expect(main.content).toContain("import { mount } from '@stewie-js/core'")
    expect(main.content).toContain('mount(<App />')
  })

  it('index.html references /src/main.tsx', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const html = files.find((f) => f.path === 'index.html')!
    expect(html.content).toContain('src/main.tsx')
  })

  it('does not include server.ts', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    expect(files.map((f) => f.path)).not.toContain('src/server.ts')
  })

  it('App.tsx uses JSX syntax', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const app = files.find((f) => f.path === 'src/App.tsx')!
    expect(app.content).toContain('<h1>')
    expect(app.content).not.toContain("jsx('h1'")
  })

  it('index.html contains project name in title', () => {
    const files = generateFiles({ projectName: 'my-app', mode: 'static', includeRouter: false })
    const html = files.find((f) => f.path === 'index.html')!
    expect(html.content).toContain('<title>my-app</title>')
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

describe('generateFiles — SSR mode (node)', () => {
  it('generates required files', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('package.json')
    expect(paths).toContain('vite.config.ts')
    expect(paths).toContain('src/client.tsx')
    expect(paths).toContain('src/server.ts')
    expect(paths).toContain('src/App.tsx')
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

  it('index.html references /src/client.tsx and has ssr-outlet', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const html = files.find((f) => f.path === 'index.html')!
    expect(html.content).toContain('src/client.tsx')
    expect(html.content).toContain('<!--ssr-outlet-->')
  })

  it('server.ts uses createNodeHandler', () => {
    const files = generateFiles({ projectName: 'my-ssr-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false })
    const server = files.find((f) => f.path === 'src/server.ts')!
    expect(server.content).toContain('createNodeHandler')
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
