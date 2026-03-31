import { describe, it, expect, vi } from 'vitest';
import { createBunHandler } from './adapter.js';

describe('createBunHandler', () => {
  it('returns serve options with fetch property', () => {
    const app = vi.fn(async (_req: Request) => new Response('OK'));
    const options = createBunHandler(app);
    expect(typeof options.fetch).toBe('function');
  });

  it('fetch delegates directly to the app', async () => {
    const app = vi.fn(async (_req: Request) => new Response('Hello Bun', { status: 200 }));
    const options = createBunHandler(app);

    const req = new Request('http://localhost:3000/');
    const res = await options.fetch(req);

    expect(app).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('Hello Bun');
  });

  it('passes through streaming responses', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('chunk1');
        controller.enqueue('chunk2');
        controller.close();
      }
    });
    const app = async (_req: Request) => new Response(stream as any);
    const options = createBunHandler(app);

    const req = new Request('http://localhost:3000/');
    const res = await options.fetch(req);
    expect(res.body).not.toBeNull();
  });

  it('returns 500 when the app throws', async () => {
    const app = async (_req: Request): Promise<Response> => {
      throw new Error('boom');
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const options = createBunHandler(app);

    const req = new Request('http://localhost:3000/');
    const res = await options.fetch(req);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it('forwards port and hostname options', () => {
    const app = vi.fn(async (_req: Request) => new Response('OK'));
    const options = createBunHandler(app, { port: 4000, hostname: '0.0.0.0' });
    expect(options.port).toBe(4000);
    expect(options.hostname).toBe('0.0.0.0');
  });
});
