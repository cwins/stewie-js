// A Stewie app handler — same type as the other adapters.
export type StewieApp = (req: Request) => Promise<Response> | Response;

// Minimal shape of Cloudflare's ExecutionContext. Defined locally so this
// package has no dependency on @cloudflare/workers-types; users who install
// that package will see the structural types unify.
export interface CloudflareExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// The default export shape a Module Worker needs to expose.
export interface CloudflareWorker {
  fetch(req: Request, env: unknown, ctx: CloudflareExecutionContext): Promise<Response>;
}

/**
 * Create a Cloudflare Workers Module Worker entry from a Stewie app handler.
 *
 * Cloudflare Workers natively speaks the Web `Request`/`Response` API, so the
 * adapter is a thin wrapper around the handler. Unhandled errors from the app
 * are caught and converted to 500 responses so the Worker never crashes on a
 * single bad request.
 *
 * Usage:
 * ```ts
 * import { createCloudflareHandler } from '@stewie-js/adapter-cloudflare'
 * import { app } from './app.js'
 *
 * export default createCloudflareHandler(app)
 * ```
 *
 * Note: `env` and `ctx` are accepted by the returned `fetch` to satisfy the
 * Module Worker contract, but are not yet plumbed through to the app handler.
 * Users who need env bindings or `ctx.waitUntil` access today should wrap the
 * returned handler manually.
 */
export function createCloudflareHandler(app: StewieApp): CloudflareWorker {
  return {
    async fetch(req: Request, _env: unknown, _ctx: CloudflareExecutionContext): Promise<Response> {
      try {
        return await app(req);
      } catch (err) {
        console.error('[stewie/adapter-cloudflare] Unhandled error:', err);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
  };
}
