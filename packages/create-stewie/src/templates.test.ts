import { describe, it, expect } from 'vitest'
import { generateFiles } from './templates.js'

describe('generateFiles', () => {
  it('generates basic static project files', () => {
    const files = generateFiles({
      projectName: 'my-app',
      mode: 'static',
      includeRouter: false,
    })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('package.json')
    expect(paths).toContain('vite.config.ts')
    expect(paths).toContain('tsconfig.json')
    expect(paths).toContain('index.html')
    expect(paths).toContain('src/main.tsx')
    expect(paths).toContain('src/App.tsx')
    expect(paths).toContain('src/App.module.css')
  })

  it('main.tsx calls mount() with JSX', () => {
    const files = generateFiles({
      projectName: 'my-app',
      mode: 'static',
      includeRouter: false,
    })
    const main = files.find((f) => f.path === 'src/main.tsx')!
    expect(main.content).toContain("import { mount } from '@stewie/core'")
    expect(main.content).toContain('mount(<App />')
  })

  it('App.tsx uses JSX syntax (not jsx() calls)', () => {
    const files = generateFiles({
      projectName: 'my-app',
      mode: 'static',
      includeRouter: false,
    })
    const app = files.find((f) => f.path === 'src/App.tsx')!
    expect(app.content).toContain('<h1>')
    expect(app.content).not.toContain("jsx('h1'")
  })

  it('includes server.ts for SSR mode', () => {
    const files = generateFiles({
      projectName: 'my-ssr-app',
      mode: 'ssr',
      ssrRuntime: 'node',
      includeRouter: false,
    })
    const paths = files.map((f) => f.path)
    expect(paths).toContain('src/server.ts')
  })

  it('does not include server.ts for static mode', () => {
    const files = generateFiles({
      projectName: 'my-app',
      mode: 'static',
      includeRouter: false,
    })
    const paths = files.map((f) => f.path)
    expect(paths).not.toContain('src/server.ts')
  })

  it('includes router dep when includeRouter is true', () => {
    const files = generateFiles({
      projectName: 'my-app',
      mode: 'static',
      includeRouter: true,
    })
    const pkgJson = files.find((f) => f.path === 'package.json')!
    expect(pkgJson.content).toContain('@stewie/router')
  })

  it('sets correct project name in package.json', () => {
    const files = generateFiles({
      projectName: 'awesome-project',
      mode: 'static',
      includeRouter: false,
    })
    const pkgJson = files.find((f) => f.path === 'package.json')!
    expect(JSON.parse(pkgJson.content).name).toBe('awesome-project')
  })

  it('generates bun server for bun runtime', () => {
    const files = generateFiles({
      projectName: 'bun-app',
      mode: 'ssr',
      ssrRuntime: 'bun',
      includeRouter: false,
    })
    const server = files.find((f) => f.path === 'src/server.ts')!
    expect(server.content).toContain('createBunHandler')
  })

  it('index.html contains project name in title', () => {
    const files = generateFiles({
      projectName: 'my-app',
      mode: 'static',
      includeRouter: false,
    })
    const html = files.find((f) => f.path === 'index.html')!
    expect(html.content).toContain('<title>my-app</title>')
  })
})
