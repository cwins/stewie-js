import { describe, it, expect } from 'vitest'
import { renderToStream } from './stream.js'
import { jsx, Suspense } from '@stewie-js/core'
import type { Component, JSXElement } from '@stewie-js/core'

// Collect all chunks from a ReadableStream into an array
async function collectChunks(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    if (text) chunks.push(text)
  }
  return chunks
}

async function collectAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  return (await collectChunks(stream)).join('')
}

describe('renderToStream', () => {
  it('returns a ReadableStream<Uint8Array>', () => {
    const stream = renderToStream(jsx('div', { children: 'hello' }))
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('produces correct HTML for a simple element', async () => {
    const html = await collectAll(renderToStream(jsx('p', { children: 'world' })))
    expect(html).toContain('<p>world</p>')
  })

  it('produces correct HTML for nested elements', async () => {
    const html = await collectAll(
      renderToStream(
        jsx('div', {
          class: 'wrapper',
          children: jsx('span', { children: 'nested' }),
        }),
      ),
    )
    expect(html).toContain('<div class="wrapper"><span>nested</span></div>')
  })

  it('sends multiple chunks — does not buffer the entire response', async () => {
    // A tree with a nested async component. The outer shell chunks should
    // arrive before the slow component resolves.
    async function SlowChild(): Promise<JSXElement> {
      await new Promise((r) => setTimeout(r, 10))
      return jsx('span', { children: 'slow' })
    }

    const chunks = await collectChunks(
      renderToStream(
        jsx('div', {
          children: [
            jsx('header', { children: 'fast' }),
            jsx(SlowChild as unknown as Component, {}),
          ],
        }),
      ),
    )

    // Must receive more than one chunk (streaming, not buffered)
    expect(chunks.length).toBeGreaterThan(1)

    // The opening div tag arrives in an early chunk, before the slow content
    const divChunkIndex = chunks.findIndex((c) => c.includes('<div>'))
    const slowChunkIndex = chunks.findIndex((c) => c.includes('slow'))
    expect(divChunkIndex).toBeLessThan(slowChunkIndex)

    const fullHtml = chunks.join('')
    expect(fullHtml).toContain('<header>fast</header>')
    expect(fullHtml).toContain('slow')
  })

  it('streams Suspense fallback immediately, then injects resolved content', async () => {
    async function SlowData(): Promise<JSXElement> {
      await new Promise((r) => setTimeout(r, 10))
      return jsx('p', { 'data-testid': 'result', children: 'loaded' })
    }

    const chunks = await collectChunks(
      renderToStream(
        jsx(Suspense as unknown as Component, {
          fallback: jsx('p', { children: 'Loading...' }),
          children: jsx(SlowData as unknown as Component, {}),
        }),
      ),
    )

    const fullHtml = chunks.join('')

    // Fallback is present in the initial output
    expect(fullHtml).toContain('Loading...')
    // Real content appears after the fallback resolves
    expect(fullHtml).toContain('loaded')
    // A swap script is injected
    expect(fullHtml).toContain('<script>')

    // The fallback chunk arrives before the real content chunk
    const fallbackChunkIndex = chunks.findIndex((c) => c.includes('Loading...'))
    const realContentChunkIndex = chunks.findIndex((c) => c.includes('loaded'))
    expect(fallbackChunkIndex).toBeLessThan(realContentChunkIndex)
  })

  it('includes __STEWIE_STATE__ script at the end', async () => {
    const html = await collectAll(renderToStream(jsx('div', { children: 'ok' })))
    expect(html).toContain('__STEWIE_STATE__')
    // State script should be at the end of the stream
    const stateIndex = html.indexOf('__STEWIE_STATE__')
    const divIndex = html.indexOf('<div>')
    expect(stateIndex).toBeGreaterThan(divIndex)
  })

  it('escapes HTML entities in text content', async () => {
    const html = await collectAll(renderToStream(jsx('p', { children: '<script>evil</script>' })))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>evil</script>')
  })
})
