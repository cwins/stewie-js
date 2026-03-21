import { describe, it, expect } from 'vitest'
import { parseArgs } from './prompts.js'

describe('parseArgs', () => {
  it('parses project name from first arg', () => {
    const opts = parseArgs(['my-project'])
    expect(opts.projectName).toBe('my-project')
  })

  it('parses --mode flag', () => {
    const opts = parseArgs(['my-app', '--mode=ssr'])
    expect(opts.mode).toBe('ssr')
  })

  it('parses --runtime flag', () => {
    const opts = parseArgs(['my-app', '--mode=ssr', '--runtime=bun'])
    expect(opts.ssrRuntime).toBe('bun')
  })

  it('parses --router flag', () => {
    const opts = parseArgs(['my-app', '--router'])
    expect(opts.includeRouter).toBe(true)
  })

  it('returns partial when no args', () => {
    const opts = parseArgs([])
    expect(opts.projectName).toBeUndefined()
  })
})
