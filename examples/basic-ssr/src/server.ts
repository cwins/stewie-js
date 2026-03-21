import { createServer } from 'node:http'
import { createNodeHandler } from '@stewie/adapter-node'
import { renderApp } from './app.js'

const handler = createNodeHandler(async (req) => {
  const url = new URL(req.url)

  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const html = await renderApp()
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
})

const server = createServer(handler)
const PORT = parseInt(process.env.PORT ?? '3000', 10)
server.listen(PORT, () => {
  console.log(`Stewie SSR demo running at http://localhost:${PORT}`)
})

export { server }
