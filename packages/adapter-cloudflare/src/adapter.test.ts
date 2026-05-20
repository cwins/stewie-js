import { describe, it, expect, vi } from 'vitest';
import { createCloudflareHandler, type CloudflareExecutionContext } from './adapter.js';

function mockCtx(): CloudflareExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn()
  };
}

describe('createCloudflareHandler', () => {
  it('returns a Module Worker shape with a fetch method', () => {
    const app = vi.fn(async (_req: Request) => new Response('OK'));
    const worker = createCloudflareHandler(app);
    expect(typeof worker.fetch).toBe('function');
  });

  it('fetch delegates to the app handler', async () => {
    const app = vi.fn(async (_req: Request) => new Response('Hello Workers', { status: 200 }));
    const worker = createCloudflareHandler(app);

    const req = new Request('https://example.com/');
    const res = await worker.fetch(req, {}, mockCtx());

    expect(app).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello Workers');
  });

  it('passes through streaming responses', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.close();
      }
    });
    const app = async (_req: Request) => new Response(stream as unknown as BodyInit);
    const worker = createCloudflareHandler(app);

    const req = new Request('https://example.com/');
    const res = await worker.fetch(req, {}, mockCtx());
    expect(res.body).not.toBeNull();
  });

  it('returns 500 when the app throws', async () => {
    const app = async (_req: Request): Promise<Response> => {
      throw new Error('boom');
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const worker = createCloudflareHandler(app);

    const req = new Request('https://example.com/');
    const res = await worker.fetch(req, {}, mockCtx());

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Internal Server Error');
    consoleSpy.mockRestore();
  });

  it('does not propagate env or ctx to the app handler (v1 limitation)', async () => {
    const app = vi.fn(async (_req: Request) => new Response('OK'));
    const worker = createCloudflareHandler(app);

    const req = new Request('https://example.com/');
    const env = { SECRET: 'shh' };
    const ctx = mockCtx();
    await worker.fetch(req, env, ctx);

    // app is called with just the Request; env and ctx are not forwarded yet.
    expect(app).toHaveBeenCalledWith(req);
    expect(app).toHaveBeenCalledTimes(1);
  });
});
