import type { Plugin } from 'vite';
import { resolve as resolvePath, relative as relativePath, dirname, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { compile, createProjectProgram } from '@stewie-js/compiler';
import type { TsProgram } from '@stewie-js/compiler';

/**
 * Stereotyped pattern: `lazy(() => import('SPEC'))` or with default-export
 * unwrapping. The transform injects a second argument — the SPEC resolved to
 * a root-relative source ID — so the SSR renderer can index Vite's
 * `ssr-manifest.json` and emit progressive `<link>` hints.
 *
 * Idempotent: if a second arg is already present (string literal), skip.
 * Plain `lazy()` calls without an inline arrow + import() get no transform —
 * they fall back to the no-asset-hint path at SSR.
 */
const LAZY_IMPORT_RE = /\blazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*(['"])([^'"]+)\1\s*\)\s*\)/g;

// Vite's ssr-manifest keys include the source-file extension (e.g. `src/pages/foo.tsx`),
// but module specifiers are commonly written without one (`./pages/foo`) or with the
// runtime `.js` extension (`./pages/foo.js`). Resolve to the actual on-disk source file
// so the injected id matches the manifest key the SSR renderer will look up.
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

function resolveSourceExtension(absoluteWithoutExt: string, originalExt: string): string {
  if (originalExt && existsSync(absoluteWithoutExt + originalExt)) return originalExt;
  for (const ext of SOURCE_EXTENSIONS) {
    if (existsSync(absoluteWithoutExt + ext)) return ext;
  }
  return originalExt;
}

function injectLazyIds(code: string, fileId: string, root: string): string {
  return code.replace(LAZY_IMPORT_RE, (match, quote: string, spec: string) => {
    let resolvedSpec = spec;
    if (spec.startsWith('.')) {
      const absolute = resolvePath(dirname(fileId), spec);
      const originalExt = extname(absolute);
      const stem = originalExt ? absolute.slice(0, -originalExt.length) : absolute;
      const ext = resolveSourceExtension(stem, originalExt);
      resolvedSpec = relativePath(root, stem + ext);
      // Vite manifest keys use forward slashes regardless of platform
      if (resolvedSpec.includes('\\')) resolvedSpec = resolvedSpec.replace(/\\/g, '/');
    }
    // Strip the trailing `)` and inject the second arg before it
    return match.slice(0, -1) + `, ${quote}${resolvedSpec}${quote})`;
  });
}

export interface StewiePluginOptions {
  /**
   * Enable the JSX-to-DOM compiler transform, which replaces native HTML JSX
   * with direct `document.createElement()` calls and fine-grained `effect()`
   * subscriptions — no virtual DOM diffing at runtime.
   *
   * Defaults to `true`. Set to `false` to opt out (e.g. for debugging).
   */
  jsxToDom?: boolean;

  /**
   * Inject the Stewie DevTools panel into the dev server's HTML.
   *
   * Defaults to `true`. Production builds never receive it either way.
   *
   * Set to `false` to keep the package out of the page entirely — useful when
   * profiling, since instrumentation that is never loaded cannot be mistaken
   * for application cost. `destroyDevtools()` removes it at runtime instead,
   * but that still loads and initializes the package first.
   */
  devtools?: boolean;
}

export function stewie(options?: StewiePluginOptions): Plugin {
  let viteRoot = process.cwd();
  // Lazily-initialized TypeScript program — created on the first .tsx transform
  // so it doesn't block Vite's startup. Cached for the session; stale during
  // HMR (compile() falls back to heuristic when content doesn't match).
  let tsProgram: TsProgram | undefined;
  let tsProgramInitialized = false;

  function getProgram(): TsProgram | undefined {
    if (tsProgramInitialized) return tsProgram;
    tsProgramInitialized = true;
    tsProgram = createProjectProgram(viteRoot);
    return tsProgram;
  }

  return {
    name: 'stewie',
    // Run before Vite's internal esbuild plugin so the Stewie compiler sees
    // the raw .tsx source (with JSX) rather than already-transpiled jsxDEV calls.
    enforce: 'pre' as const,

    configResolved(config) {
      viteRoot = config.root;
    },

    // Configure the JSX transform's import source so JSX in .tsx files compiles
    // to @stewie-js/core's descriptor runtime without relying on per-file
    // pragma comments.
    //
    // Only `oxc` is set. Vite 8 transforms with oxc and warns when a plugin
    // sets the `esbuild` key ("deprecated, please use `oxc`"); oxc takes
    // precedence when both are present, so setting both bought nothing and
    // printed a warning on every build. This package peer-depends on
    // vite@^8.0.0, so the esbuild path was already outside its support range.
    config() {
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oxc: {
          jsx: {
            importSource: '@stewie-js/core',
            runtime: 'automatic'
          }
        } as any
      };
    },

    // Transform .tsx files through the Stewie compiler
    transform(code: string, id: string, transformOptions?: { ssr?: boolean }) {
      if (!id.endsWith('.tsx')) return null;

      // Inject lazy() asset-manifest IDs before running the Stewie compiler.
      // The same ID lands in both client and SSR builds, so the SSR renderer
      // can look the chunk's CSS up in Vite's `ssr-manifest.json`.
      code = injectLazyIds(code, id, viteRoot);

      const isDev = process.env.NODE_ENV !== 'production';
      // jsxToDom emits document.createElement() calls — DOM APIs don't exist on
      // the server, so disable the transform for SSR module evaluation.
      const jsxToDom = !transformOptions?.ssr && (options?.jsxToDom ?? true);

      const result = compile(code, {
        filename: id,
        dev: isDev,
        sourcemap: true,
        inlineSourcemap: isDev,
        jsxToDom,
        program: getProgram()
      });

      // Surface compiler errors to Vite's error overlay
      if (result.errors.length > 0) {
        const firstError = result.errors[0];
        this.error({
          message: firstError.message,
          loc: {
            file: id,
            line: firstError.line,
            column: firstError.column - 1 // Vite uses 0-based columns
          }
        });
      }

      // Log warnings
      for (const warning of result.warnings) {
        this.warn({
          message: warning.message,
          loc: {
            file: id,
            line: warning.line,
            column: warning.column - 1
          }
        });
      }

      return {
        code: result.code,
        map: result.map ? JSON.parse(result.map) : null
      };
    },

    // HMR: recompile changed .tsx files, preserve component state
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith('.tsx')) return;
      // Vite's default HMR handles module invalidation;
      // we just need to ensure the transform runs on the new content.
      // Return undefined to let Vite handle the HMR update normally
      // (our transform hook will fire again when the module is re-requested).
      return;
    },

    transformIndexHtml: {
      order: 'pre' as const,
      handler(_html: string, ctx: { server?: unknown }) {
        if (!ctx.server) return; // prod build — skip
        if (options?.devtools === false) return; // opted out
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: `import('@stewie-js/devtools').then(function(m){ m.initDevtools() }).catch(function(){})`,
            injectTo: 'body' as const
          }
        ];
      }
    }
  };
}
