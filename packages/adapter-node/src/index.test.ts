import { describe, it, expect } from 'vitest'
import { version } from './index.js'

describe('@stewie/adapter-node', () => {
  it('exports version', () => {
    expect(version).toBe('0.0.1')
  })
})
