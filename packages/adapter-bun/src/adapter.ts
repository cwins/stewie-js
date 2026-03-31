// A Stewie app handler — same type as adapter-node
export type StewieApp = (req: Request) => Promise<Response> | Response;

// Bun.serve options shape (minimal, not importing Bun types in source)
export interface BunServeOptions {
  fetch: (req: Request) => Promise<Response> | Response;
  port?: number;
  hostname?: string;
}

/**
 * Create Bun.serve() options from a Stewie app handler.
 *
 * Bun natively uses the Web `Request`/`Response` API, so no conversion layer
 * is needed — the handler is wired directly as the `fetch` callback. Unhandled
 * errors from the app are caught and converted to 500 responses so the server
 * never crashes on a single bad request.
 *
 * Usage:
 * ```ts
 * Bun.serve(createBunHandler(app))
 * ```
 */
export function createBunHandler(app: StewieApp, options?: { port?: number; hostname?: string }): BunServeOptions {
  return {
    port: options?.port,
    hostname: options?.hostname,
    fetch: async (req: Request): Promise<Response> => {
      try {
        return await app(req);
      } catch (err) {
        console.error('[stewie/adapter-bun] Unhandled error:', err);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
  };
}
