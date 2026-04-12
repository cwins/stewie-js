/**
 * Scaffold conformance tests — generate each template combination into a temp
 * directory and run `tsc --noEmit` to verify the generated TypeScript compiles
 * cleanly. This catches bugs in template string code that unit tests miss.
 */
import { describe, it } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFiles } from './templates.js';
import type { TemplateContext } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, '../../..');
const TSC = resolve(WORKSPACE_ROOT, 'node_modules/.bin/tsc');
const VITEST = resolve(WORKSPACE_ROOT, 'node_modules/.bin/vitest');
const VITE = resolve(WORKSPACE_ROOT, 'packages/vite/node_modules/.bin/vite');

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
  '@stewie-js/router-spi': [resolve(WORKSPACE_ROOT, 'packages/router-spi/src/index.ts')],
  '@stewie-js/server': [resolve(WORKSPACE_ROOT, 'packages/server/src/index.ts')],
  '@stewie-js/adapter-node': [resolve(WORKSPACE_ROOT, 'packages/adapter-node/src/index.ts')],
  '@stewie-js/adapter-bun': [resolve(WORKSPACE_ROOT, 'packages/adapter-bun/src/index.ts')],
  '@stewie-js/testing': [resolve(WORKSPACE_ROOT, 'packages/testing/src/index.ts')],
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
      },
      // Test files import from vitest which requires separate type config;
      // exclude them from the typecheck pass (they're validated by vitest run).
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx']
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

// Resolve aliases used in the vitest conformance config (same packages as STEWIE_PATHS).
const STEWIE_ALIASES = [
  { find: '@stewie-js/core/jsx-dev-runtime', replacement: resolve(WORKSPACE_ROOT, 'packages/core/src/jsx-dev-runtime.ts') },
  { find: '@stewie-js/core/jsx-runtime', replacement: resolve(WORKSPACE_ROOT, 'packages/core/src/jsx-runtime.ts') },
  { find: '@stewie-js/core', replacement: resolve(WORKSPACE_ROOT, 'packages/core/src/index.ts') },
  { find: '@stewie-js/router-spi', replacement: resolve(WORKSPACE_ROOT, 'packages/router-spi/src/index.ts') },
  { find: '@stewie-js/router', replacement: resolve(WORKSPACE_ROOT, 'packages/router/src/index.ts') },
  { find: '@stewie-js/server', replacement: resolve(WORKSPACE_ROOT, 'packages/server/src/index.ts') },
  { find: '@stewie-js/adapter-node', replacement: resolve(WORKSPACE_ROOT, 'packages/adapter-node/src/index.ts') },
  { find: '@stewie-js/adapter-bun', replacement: resolve(WORKSPACE_ROOT, 'packages/adapter-bun/src/index.ts') },
  { find: '@stewie-js/testing', replacement: resolve(WORKSPACE_ROOT, 'packages/testing/src/index.ts') }
];

/**
 * Layer 2 — vitest run.
 *
 * Generates scaffold files (including test files) into a temp directory
 * **inside** WORKSPACE_ROOT so Node.js module resolution walks up and finds
 * the workspace node_modules. Writes a vitest config with resolve.alias
 * pointing all @stewie-js/* packages to workspace source, then runs vitest.
 */
function testScaffold(ctx: TemplateContext): void {
  const files = generateFiles(ctx);
  // Temp dir inside workspace root — enables Node module resolution to walk
  // up to WORKSPACE_ROOT/node_modules without a pnpm install in tempDir.
  const dir = mkdtempSync(join(WORKSPACE_ROOT, '.scaffold-tmp-'));

  try {
    for (const file of files) {
      const fullPath = join(dir, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content);
    }

    // Relative path from WORKSPACE_ROOT — used in include patterns (relative to root).
    const relDir = relative(WORKSPACE_ROOT, dir);

    // Write a custom vitest config. Using .mjs so Node can execute it directly.
    // 'root' must be WORKSPACE_ROOT so vitest's own packages resolve from
    // the workspace node_modules even though test files live in tempDir.
    const vitestConf = `
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const WORKSPACE_ROOT = ${JSON.stringify(WORKSPACE_ROOT)}

export default defineConfig({
  root: WORKSPACE_ROOT,
  test: {
    environment: 'happy-dom',
    include: [${JSON.stringify(relDir + '/src/**/*.test.ts')}, ${JSON.stringify(relDir + '/src/**/*.test.tsx')}],
    reporters: ['default'],
  },
  esbuild: {
    jsxImportSource: '@stewie-js/core',
  },
  resolve: {
    alias: ${JSON.stringify(STEWIE_ALIASES, null, 4)}
  }
})
`;
    writeFileSync(join(dir, 'vitest.conf.mjs'), vitestConf);

    execSync(`${VITEST} run --config ${join(dir, 'vitest.conf.mjs')}`, {
      stdio: 'pipe',
      cwd: WORKSPACE_ROOT
    });
  } catch (err: unknown) {
    const output = err as { stdout?: Buffer; stderr?: Buffer };
    const msg = [output.stdout?.toString(), output.stderr?.toString()].filter(Boolean).join('\n');
    throw new Error(`vitest failed for scaffold ${JSON.stringify(ctx)}:\n${msg}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Layer 3 — vite build.
 *
 * Generates scaffold files into a temp directory inside WORKSPACE_ROOT, then
 * runs `vite build` with a custom conformance config. The scaffold's own
 * vite.config.ts imports @stewie-js/vite which fails under pnpm's ESM module
 * resolution from .vite-temp (ESM doesn't use NODE_PATH). Instead we write a
 * conformance config that:
 *   - Has no external package imports (only Node built-ins)
 *   - Sets esbuild.jsxImportSource to drive TSX without the stewie plugin
 *   - Uses resolve.alias to map @stewie-js/* to workspace source files
 *
 * Only the client build is exercised (no --ssr) since it is the primary
 * correctness signal and avoids the multi-step SSR build sequence.
 */
function buildScaffold(ctx: TemplateContext): void {
  const files = generateFiles(ctx);
  const dir = mkdtempSync(join(WORKSPACE_ROOT, '.scaffold-tmp-'));

  try {
    for (const file of files) {
      const fullPath = join(dir, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content);
    }

    // Write a self-contained vite config (.mjs) with no external imports.
    // Embedding absolute paths avoids any pnpm/ESM resolution issues.
    const viteConf = `
// Conformance vite build config — no external package imports.
// resolve.alias handles @stewie-js/* so vite never needs the stewie() plugin.
export default {
  root: ${JSON.stringify(dir)},
  esbuild: {
    jsxImportSource: '@stewie-js/core',
    jsx: 'automatic',
  },
  resolve: {
    alias: ${JSON.stringify(STEWIE_ALIASES, null, 4)}
  },
  build: {
    outDir: ${JSON.stringify(join(dir, 'dist/client'))},
    emptyOutDir: true,
    rollupOptions: {
      input: ${JSON.stringify(join(dir, 'index.html'))},
    },
  },
}
`;
    writeFileSync(join(dir, 'vite.conformance.config.mjs'), viteConf);

    execSync(`${VITE} build --config ${join(dir, 'vite.conformance.config.mjs')}`, {
      stdio: 'pipe',
      cwd: WORKSPACE_ROOT
    });
  } catch (err: unknown) {
    const output = err as { stdout?: Buffer; stderr?: Buffer };
    const msg = [output.stdout?.toString(), output.stderr?.toString()].filter(Boolean).join('\n');
    throw new Error(`vite build failed for scaffold ${JSON.stringify(ctx)}:\n${msg}`);
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

describe('scaffold conformance — vitest run', () => {
  for (const ctx of COMBINATIONS) {
    const label = `${ctx.mode}${ctx.mode === 'ssr' ? `+${ctx.ssrRuntime}` : ''}+${ctx.includeRouter ? 'router' : 'no-router'}`;
    it(`tests pass: ${label}`, () => {
      testScaffold(ctx);
    });
  }
});

describe('scaffold conformance — vite build', () => {
  for (const ctx of COMBINATIONS) {
    const label = `${ctx.mode}${ctx.mode === 'ssr' ? `+${ctx.ssrRuntime}` : ''}+${ctx.includeRouter ? 'router' : 'no-router'}`;
    it(`builds: ${label}`, () => {
      buildScaffold(ctx);
    });
  }
});
