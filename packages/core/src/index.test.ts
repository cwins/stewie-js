import { describe, it, expect } from 'vitest'
import { version } from './index.js'

describe('@stewie-js/core', () => {
  it('exports version', () => {
    expect(version).toBe('0.1.0')
  })
})
