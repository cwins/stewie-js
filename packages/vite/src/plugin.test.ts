import { describe, it, expect, vi } from 'vitest'
import { stewie } from './plugin.js'

describe('stewie vite plugin', () => {
  it('has name "stewie"', () => {
    const plugin = stewie()
    expect(plugin.name).toBe('stewie')
  })

  it('transform: returns null for non-.tsx files', async () => {
    const plugin = stewie()
    const transform = plugin.transform as Function
    // Need a mock `this` context
    const ctx = { error: vi.fn(), warn: vi.fn() }
    const result = await transform.call(ctx, 'const x = 1', 'file.ts')
    expect(result).toBeNull()
  })

  it('transform: processes .tsx files and returns code', async () => {
    const plugin = stewie()
    const transform = plugin.transform as Function
    const ctx = { error: vi.fn(), warn: vi.fn() }
    const result = await transform.call(ctx, 'const x: number = 1', 'file.tsx')
    expect(result).not.toBeNull()
    expect(result.code).toContain('const x')
  })

  it('transform: injects DOM JSX pragma for client builds', async () => {
    const plugin = stewie()
    const transform = plugin.transform as Function
    const ctx = { error: vi.fn(), warn: vi.fn() }
    const result = await transform.call(ctx, 'const x = 1', 'file.tsx', { ssr: false })
    expect(result.code).toContain('@jsxImportSource @stewie/core/dom')
  })

  it('transform: does NOT inject DOM pragma for SSR builds', async () => {
    const plugin = stewie()
    const transform = plugin.transform as Function
    const ctx = { error: vi.fn(), warn: vi.fn() }
    const result = await transform.call(ctx, 'const x = 1', 'file.tsx', { ssr: true })
    expect(result.code).not.toContain('@jsxImportSource @stewie/core/dom')
  })

  it('transform: surfaces compiler errors via this.error', async () => {
    const plugin = stewie()
    const transform = plugin.transform as Function
    const errorFn = vi.fn()
    const ctx = { error: errorFn, warn: vi.fn() }
    // Module-scope signal call should trigger a compiler error
    const source = `import { signal } from '@stewie/core'\nconst s = signal(0)`
    try {
      await transform.call(ctx, source, 'bad.tsx')
    } catch {
      // this.error throws in Vite
    }
    expect(errorFn).toHaveBeenCalled()
  })

  it('transform: surfaces compiler warnings via this.warn', async () => {
    const plugin = stewie()
    const transform = plugin.transform as Function
    const warnFn = vi.fn()
    const ctx = { error: vi.fn(), warn: warnFn }
    // $value + readonly should produce a warning (not an error)
    const source = `function Cmp() { return <input $value={sig} readonly /> }`
    await transform.call(ctx, source, 'warn.tsx')
    expect(warnFn).toHaveBeenCalled()
  })

  it('handleHotUpdate: skips non-.tsx files', () => {
    const plugin = stewie()
    const handleHotUpdate = plugin.handleHotUpdate as Function
    const result = handleHotUpdate({ file: 'app.ts', modules: [] })
    expect(result).toBeUndefined()
  })

  it('handleHotUpdate: returns undefined for .tsx (lets Vite handle)', () => {
    const plugin = stewie()
    const handleHotUpdate = plugin.handleHotUpdate as Function
    const result = handleHotUpdate({ file: 'app.tsx', modules: [] })
    expect(result).toBeUndefined()
  })
})
