import { describe, it, expect } from 'vitest'
import { renderToStream } from './stream.js'
import { jsx } from '@stewie/core'

describe('renderToStream', () => {
  it('returns a ReadableStream', () => {
    const stream = renderToStream(jsx('div', { children: 'hello' }))
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('streams complete HTML', async () => {
    const stream = renderToStream(jsx('p', { children: 'world' }))
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let html = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }
    expect(html).toContain('<p>world</p>')
  })
})
