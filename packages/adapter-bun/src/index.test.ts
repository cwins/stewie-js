import { describe, it, expect } from 'vitest'
import { version } from './index.js'

describe('@stewie/adapter-bun', () => {
  it('exports version', () => {
    expect(version).toBe('0.1.0')
  })
})
