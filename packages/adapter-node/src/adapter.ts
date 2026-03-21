import type { IncomingMessage, ServerResponse } from 'node:http'

// A Stewie app handler takes a Web Request and returns a Web Response
export type StewieApp = (req: Request) => Promise<Response> | Response

// Convert Node.js IncomingMessage to Web API Request
export async function nodeRequestToWebRequest(
  req: IncomingMessage,
): Promise<Request> {
  const host = req.headers.host ?? 'localhost'
  const url = `http://${host}${req.url}`

  // Collect body chunks from the async iterator
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : null

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const v of value) {
        headers.append(key, v)
      }
    } else {
      headers.set(key, value)
    }
  }

  return new Request(url, {
    method: req.method ?? 'GET',
    headers,
    body: body && body.length > 0 ? body : undefined,
  })
}

// Convert Web API Response to Node.js ServerResponse
export async function webResponseToNodeResponse(
  res: Response,
  serverRes: ServerResponse,
): Promise<void> {
  serverRes.statusCode = res.status

  res.headers.forEach((value, key) => {
    serverRes.setHeader(key, value)
  })

  const buffer = await res.arrayBuffer()
  serverRes.end(Buffer.from(buffer))
}

// Create a Node.js http.RequestListener from a StewieApp
export function createNodeHandler(
  app: StewieApp,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const webReq = await nodeRequestToWebRequest(req)
    const webRes = await app(webReq)
    await webResponseToNodeResponse(webRes, res)
  }
}
