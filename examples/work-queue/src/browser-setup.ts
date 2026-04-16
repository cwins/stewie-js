/**
 * Global setup for work-queue browser tests.
 * Builds for production, then starts the prod server before the test suite.
 */
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PORT = 3098;
const BASE_URL = `http://localhost:${PORT}`;

let server: ChildProcess | undefined;

export async function setup(): Promise<void> {
  console.log('[browser-setup] building for production…');
  execSync('pnpm run build', { cwd: ROOT, stdio: 'inherit' });

  server = spawn('node', ['dist/server/server.js'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: 'pipe'
  });

  server.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));

  await waitForServer(BASE_URL, 15_000);
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
