/**
 * Scaffold conformance tests — generate each template combination into a temp
 * directory and run `tsc --noEmit` to verify the generated TypeScript compiles
 * cleanly. This catches bugs in template string code that unit tests miss.
 */
import { describe, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFiles } from './templates.js';
import type { TemplateContext } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, '../../..');
const TSC = resolve(WORKSPACE_ROOT, 'node_modules/.bin/tsc');

// Path mappings so tsc can resolve @stewie-js/* and third-party packages from
// local source without running pnpm install in the temp directory.
const PNPM_STORE = resolve(WORKSPACE_ROOT, 'node_modules/.pnpm');

function pnpmPkg(glob: string, subpath: string): string[] {
  // Find the first matching versioned package dir in the pnpm store.
  const entries = (() => {
    try {
      return require('node:fs').readdirSync(PNPM_STORE) as string[];
    } catch {
      return [];
    }
  })();
  const match = entries.find((e) => e.startsWith(glob + '@'));
  if (!match) return [];
  return [resolve(PNPM_STORE, match, 'node_modules', glob, subpath)];
}

const STEWIE_PATHS: Record<string, string[]> = {
  '@stewie-js/core': [resolve(WORKSPACE_ROOT, 'packages/core/src/index.ts')],
  '@stewie-js/core/jsx-runtime': [resolve(WORKSPACE_ROOT, 'packages/core/src/jsx-runtime.ts')],
  '@stewie-js/router': [resolve(WORKSPACE_ROOT, 'packages/router/src/index.ts')],
  '@stewie-js/server': [resolve(WORKSPACE_ROOT, 'packages/server/src/index.ts')],
  '@stewie-js/adapter-node': [resolve(WORKSPACE_ROOT, 'packages/adapter-node/src/index.ts')],
  '@stewie-js/adapter-bun': [resolve(WORKSPACE_ROOT, 'packages/adapter-bun/src/index.ts')],
  // vite is a dev dep of scaffolded server.ts — resolve from pnpm store
  vite: pnpmPkg('vite', 'dist/node/index.d.ts')
};

function typecheckScaffold(ctx: TemplateContext): void {
  const files = generateFiles(ctx);
  const dir = mkdtempSync(join(tmpdir(), 'stewie-conformance-'));

  try {
    for (const file of files) {
      const fullPath = join(dir, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content);
    }

    // Parse the generated tsconfig and inject workspace path mappings so tsc
    // can resolve @stewie-js/* imports without pnpm install.
    const tsconfigFile = files.find((f) => f.path === 'tsconfig.json');
    const base = tsconfigFile ? JSON.parse(tsconfigFile.content) : {};
    const tsconfigWithPaths = {
      ...base,
      compilerOptions: {
        ...base.compilerOptions,
        paths: STEWIE_PATHS,
        // Include node types so @stewie-js/* source files that reference
        // `process` (reactive.ts, hydrate.ts) resolve cleanly via the
        // workspace path mappings.
        types: ['node'],
        typeRoots: [resolve(WORKSPACE_ROOT, 'node_modules/@types')]
      }
    };
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfigWithPaths, null, 2));

    execSync(`${TSC} --noEmit --project ${join(dir, 'tsconfig.json')}`, {
      stdio: 'pipe',
      cwd: WORKSPACE_ROOT
    });
  } catch (err: unknown) {
    const output = err as { stdout?: Buffer; stderr?: Buffer };
    const msg = [output.stdout?.toString(), output.stderr?.toString()].filter(Boolean).join('\n');
    throw new Error(`tsc failed for scaffold ${JSON.stringify(ctx)}:\n${msg}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Six scaffold combinations
const COMBINATIONS: TemplateContext[] = [
  { projectName: 'test-app', mode: 'static', includeRouter: false },
  { projectName: 'test-app', mode: 'static', includeRouter: true },
  { projectName: 'test-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: false },
  { projectName: 'test-app', mode: 'ssr', ssrRuntime: 'node', includeRouter: true },
  { projectName: 'test-app', mode: 'ssr', ssrRuntime: 'bun', includeRouter: false },
  { projectName: 'test-app', mode: 'ssr', ssrRuntime: 'bun', includeRouter: true }
];

describe('scaffold conformance — tsc --noEmit', () => {
  for (const ctx of COMBINATIONS) {
    const label = `${ctx.mode}${ctx.mode === 'ssr' ? `+${ctx.ssrRuntime}` : ''}+${ctx.includeRouter ? 'router' : 'no-router'}`;
    it(`type-checks: ${label}`, () => {
      typecheckScaffold(ctx);
    });
  }
});
