/**
 * Global setup for work-queue gating tests.
 *
 * Builds for production once, then starts the prod server with
 * STEWIE_CSS_DELAY set so client-side CSS load gating in lazy() becomes
 * observable in the browser. Mirrors browser-setup.ts but on a different
 * port and with the delay middleware enabled.
 */
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PORT = 3099;
const CSS_DELAY_MS = 400;
const BASE_URL = `http://localhost:${PORT}`;

let server: ChildProcess | undefined;

export async function setup(): Promise<void> {
  console.log('[gating-setup] building for production…');
  execSync('pnpm run build', { cwd: ROOT, stdio: 'inherit' });

  server = spawn('node', ['dist/server/server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(PORT),
      STEWIE_CSS_DELAY: String(CSS_DELAY_MS)
    },
    stdio: 'pipe'
  });

  server.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));

  await waitForServer(BASE_URL, 20_000);
}

export async function teardown(): Promise<void> {
  server?.kill();
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}
