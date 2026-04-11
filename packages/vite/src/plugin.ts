import type { Plugin } from 'vite';
import { compile, createProjectProgram } from '@stewie-js/compiler';
import type { TsProgram } from '@stewie-js/compiler';

export interface StewiePluginOptions {
  /**
   * Enable the JSX-to-DOM compiler transform, which replaces native HTML JSX
   * with direct `document.createElement()` calls and fine-grained `effect()`
   * subscriptions — no virtual DOM diffing at runtime.
   *
   * Defaults to `true`. Set to `false` to opt out (e.g. for debugging).
   */
  jsxToDom?: boolean;
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

    // Configure esbuild's jsxImportSource so JSX in .tsx files compiles to
    // @stewie-js/core's descriptor runtime without relying on per-file pragma comments.
    config() {
      return {
        esbuild: {
          jsxImportSource: '@stewie-js/core'
        }
      };
    },

    // Transform .tsx files through the Stewie compiler
    transform(code: string, id: string, transformOptions?: { ssr?: boolean }) {
      if (!id.endsWith('.tsx')) return null;

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
