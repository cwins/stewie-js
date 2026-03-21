// A Stewie app handler — same type as adapter-node
export type StewieApp = (req: Request) => Promise<Response> | Response

// Bun.serve options shape (minimal, not importing Bun types in source)
export interface BunServeOptions {
  fetch: (req: Request) => Promise<Response> | Response
  port?: number
  hostname?: string
}

// Create a Bun-compatible server options object
export function createBunHandler(app: StewieApp): BunServeOptions {
  return {
    fetch: app,
  }
}
