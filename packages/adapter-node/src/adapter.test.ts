import { describe, it, expect, vi } from 'vitest'
import { nodeRequestToWebRequest, webResponseToNodeResponse, createNodeHandler } from './adapter.js'

describe('nodeRequestToWebRequest', () => {
  it('constructs a Web Request from Node IncomingMessage', async () => {
    const mockReq = {
      method: 'GET',
      url: '/hello?foo=bar',
      headers: { host: 'localhost:3000' },
      // Simulate empty body stream
      [Symbol.asyncIterator]: async function* () {},
    }
    const webReq = await nodeRequestToWebRequest(mockReq as any)
    expect(webReq.url).toBe('http://localhost:3000/hello?foo=bar')
    expect(webReq.method).toBe('GET')
  })

  it('includes request headers', async () => {
    const mockReq = {
      method: 'POST',
      url: '/api',
      headers: { host: 'example.com', 'content-type': 'application/json' },
      [Symbol.asyncIterator]: async function* () {},
    }
    const webReq = await nodeRequestToWebRequest(mockReq as any)
    expect(webReq.headers.get('content-type')).toBe('application/json')
  })
})

describe('webResponseToNodeResponse', () => {
  it('writes status and headers to ServerResponse', async () => {
    const webRes = new Response('Hello World', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
    const written: string[] = []
    const mockServerRes = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn((data: string) => written.push(data)),
    }
    await webResponseToNodeResponse(webRes, mockServerRes as any)
    expect(mockServerRes.statusCode).toBe(200)
    expect(mockServerRes.setHeader).toHaveBeenCalledWith('content-type', 'text/plain')
    expect(mockServerRes.end).toHaveBeenCalled()
  })
})

describe('createNodeHandler', () => {
  it('converts request and response', async () => {
    const app = vi.fn(async (_req: Request) => new Response('OK', { status: 200 }))
    const handler = createNodeHandler(app)

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: { host: 'localhost' },
      [Symbol.asyncIterator]: async function* () {},
    }
    const mockRes = {
      statusCode: 0,
      setHeader: vi.fn(),
      end: vi.fn(),
    }

    await handler(mockReq as any, mockRes as any)
    expect(app).toHaveBeenCalledOnce()
    expect(mockRes.statusCode).toBe(200)
  })
})
