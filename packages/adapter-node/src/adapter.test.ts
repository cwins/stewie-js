import { describe, it, expect, vi } from 'vitest';
import { nodeRequestToWebRequest, webResponseToNodeResponse, createNodeHandler } from './adapter.js';

// ---------------------------------------------------------------------------
// nodeRequestToWebRequest
// ---------------------------------------------------------------------------

describe('nodeRequestToWebRequest', () => {
  it('constructs a Web Request from Node IncomingMessage', async () => {
    const mockReq = {
      method: 'GET',
      url: '/hello?foo=bar',
      headers: { host: 'localhost:3000' },
      [Symbol.asyncIterator]: async function* () {}
    };
    const webReq = await nodeRequestToWebRequest(mockReq as never);
    expect(webReq.url).toBe('http://localhost:3000/hello?foo=bar');
    expect(webReq.method).toBe('GET');
  });

  it('includes request headers', async () => {
    const mockReq = {
      method: 'POST',
      url: '/api',
      headers: { host: 'example.com', 'content-type': 'application/json' },
      [Symbol.asyncIterator]: async function* () {}
    };
    const webReq = await nodeRequestToWebRequest(mockReq as never);
    expect(webReq.headers.get('content-type')).toBe('application/json');
  });

  it('does not read body for GET requests', async () => {
    let bodyRead = false;
    const mockReq = {
      method: 'GET',
      url: '/',
      headers: { host: 'localhost' },
      [Symbol.asyncIterator]: async function* () {
        bodyRead = true;
        yield Buffer.from('should not be read');
      }
    };
    await nodeRequestToWebRequest(mockReq as never);
    expect(bodyRead).toBe(false);
  });

  it('reads body for POST requests', async () => {
    const mockReq = {
      method: 'POST',
      url: '/api',
      headers: { host: 'localhost', 'content-type': 'application/json' },
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from('{"x":1}');
      }
    };
    const webReq = await nodeRequestToWebRequest(mockReq as never);
    const text = await webReq.text();
    expect(text).toBe('{"x":1}');
  });
});

// ---------------------------------------------------------------------------
// webResponseToNodeResponse
// ---------------------------------------------------------------------------

describe('webResponseToNodeResponse', () => {
  it('writes status and headers to ServerResponse', async () => {
    const webRes = new Response('Hello World', {
      status: 200,
      headers: { 'content-type': 'text/plain' }
    });
    const written: Buffer[] = [];
    const mockServerRes = {
      statusCode: 0,
      setHeader: vi.fn(),
      write: vi.fn((data: Buffer, cb: (err?: Error | null) => void) => {
        written.push(data);
        cb();
      }),
      end: vi.fn()
    };
    await webResponseToNodeResponse(webRes, mockServerRes as never);
    expect(mockServerRes.statusCode).toBe(200);
    expect(mockServerRes.setHeader).toHaveBeenCalledWith('content-type', 'text/plain');
    expect(mockServerRes.end).toHaveBeenCalled();
    expect(Buffer.concat(written).toString()).toBe('Hello World');
  });

  it('streams a ReadableStream body progressively', async () => {
    const encoder = new TextEncoder();
    let resolveSecondChunk!: () => void;
    const secondChunkReady = new Promise<void>((r) => {
      resolveSecondChunk = r;
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(ctrl) {
        ctrl.enqueue(encoder.encode('first'));
        await secondChunkReady;
        ctrl.enqueue(encoder.encode('second'));
        ctrl.close();
      }
    });

    const webRes = new Response(stream, { status: 200 });
    const chunks: string[] = [];
    let writeCallCount = 0;

    const mockServerRes = {
      statusCode: 0,
      setHeader: vi.fn(),
      write: vi.fn((data: Uint8Array, cb: (err?: Error | null) => void) => {
        writeCallCount++;
        chunks.push(new TextDecoder().decode(data));
        if (writeCallCount === 1) {
          // Release second chunk after first is written
          resolveSecondChunk();
        }
        cb();
      }),
      end: vi.fn()
    };

    await webResponseToNodeResponse(webRes, mockServerRes as never);
    expect(chunks).toEqual(['first', 'second']);
    expect(mockServerRes.end).toHaveBeenCalled();
  });

  it('calls end() with no body (e.g. 204 No Content)', async () => {
    const webRes = new Response(null, { status: 204 });
    const mockServerRes = {
      statusCode: 0,
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    };
    await webResponseToNodeResponse(webRes, mockServerRes as never);
    expect(mockServerRes.statusCode).toBe(204);
    expect(mockServerRes.write).not.toHaveBeenCalled();
    expect(mockServerRes.end).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createNodeHandler
// ---------------------------------------------------------------------------

describe('createNodeHandler', () => {
  it('converts request and response', async () => {
    const app = vi.fn(async (_req: Request) => new Response('OK', { status: 200 }));
    const handler = createNodeHandler(app);

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: { host: 'localhost' },
      [Symbol.asyncIterator]: async function* () {}
    };
    const mockRes = {
      statusCode: 0,
      headersSent: false,
      setHeader: vi.fn(),
      write: vi.fn((_data: unknown, cb: (err?: Error | null) => void) => cb()),
      end: vi.fn()
    };

    await handler(mockReq as never, mockRes as never);
    expect(app).toHaveBeenCalledOnce();
    expect(mockRes.statusCode).toBe(200);
  });

  it('returns 500 when the app throws', async () => {
    const app = vi.fn(async () => {
      throw new Error('boom');
    });
    const handler = createNodeHandler(app);

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: { host: 'localhost' },
      [Symbol.asyncIterator]: async function* () {}
    };
    const mockRes = {
      statusCode: 0,
      headersSent: false,
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn()
    };

    await handler(mockReq as never, mockRes as never);
    expect(mockRes.statusCode).toBe(500);
    expect(mockRes.end).toHaveBeenCalledWith('Internal Server Error');
  });

  it('destroys the socket when a write error occurs after headers are sent', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encoder.encode('partial'));
        ctrl.close();
      }
    });

    const app = vi.fn(async () => new Response(stream, { status: 200 }));
    const handler = createNodeHandler(app);

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: { host: 'localhost' },
      [Symbol.asyncIterator]: async function* () {}
    };

    let destroyed = false;
    const mockRes = {
      statusCode: 0,
      headersSent: true, // simulate headers already sent
      setHeader: vi.fn(),
      // Simulate a write error (e.g., client disconnected mid-stream)
      write: vi.fn((_data: Uint8Array, cb: (err?: Error | null) => void) => {
        cb(new Error('write error'));
      }),
      end: vi.fn(),
      destroy: vi.fn(() => {
        destroyed = true;
      })
    };

    await handler(mockReq as never, mockRes as never);
    expect(destroyed).toBe(true);
  });
});
