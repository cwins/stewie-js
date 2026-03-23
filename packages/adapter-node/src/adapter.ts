import type { IncomingMessage, ServerResponse } from 'node:http'

// A Stewie app handler takes a Web Request and returns a Web Response
export type StewieApp = (req: Request) => Promise<Response> | Response

// Methods that must not have a request body per HTTP spec
const NO_BODY_METHODS = new Set(['GET', 'HEAD', 'DELETE', 'OPTIONS', 'TRACE'])

// Convert Node.js IncomingMessage to Web API Request
export async function nodeRequestToWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost'
  const url = `http://${host}${req.url}`
  const method = (req.method ?? 'GET').toUpperCase()

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v)
    } else {
      headers.set(key, value)
    }
  }

  // Only read body for methods that may carry one
  let body: Buffer | null = null
  if (!NO_BODY_METHODS.has(method)) {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    body = chunks.length > 0 ? Buffer.concat(chunks) : null
  }

  return new Request(url, {
    method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  })
}

// Convert Web API Response to Node.js ServerResponse.
// Streams the body progressively instead of buffering it all in memory, so
// renderToStream() responses (ReadableStream<Uint8Array>) flow to the client
// as chunks arrive rather than after the full render completes.
export async function webResponseToNodeResponse(
  webRes: Response,
  serverRes: ServerResponse,
): Promise<void> {
  serverRes.statusCode = webRes.status
  webRes.headers.forEach((value, key) => {
    serverRes.setHeader(key, value)
  })

  if (!webRes.body) {
    serverRes.end()
    return
  }

  const reader = webRes.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // Write with backpressure: wait for the chunk to be flushed before
      // reading the next one so we don't accumulate unbounded in memory.
      await new Promise<void>((resolve, reject) => {
        serverRes.write(value, (err) => (err ? reject(err) : resolve()))
      })
    }
    serverRes.end()
  } catch (err) {
    reader.cancel()
    throw err
  }
}

// Create a Node.js http.RequestListener from a StewieApp
export function createNodeHandler(
  app: StewieApp,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const webReq = await nodeRequestToWebRequest(req)
      const webRes = await app(webReq)
      await webResponseToNodeResponse(webRes, res)
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('Internal Server Error')
      } else {
        // Headers already sent — can't change status. Destroy the socket to
        // signal an incomplete response rather than leaving the client hanging.
        res.destroy(err instanceof Error ? err : new Error(String(err)))
      }
    }
  }
}
