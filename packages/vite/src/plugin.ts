import type { Plugin } from 'vite'
import { compile } from '@stewie-js/compiler'

export interface StewiePluginOptions {
  /**
   * Enable the JSX-to-DOM compiler transform, which replaces native HTML JSX
   * with direct `document.createElement()` calls and fine-grained `effect()`
   * subscriptions — no virtual DOM diffing at runtime.
   *
   * This is the core differentiator of the Stewie compiler. Defaults to
   * `false` while the transform stabilises; set to `true` to opt in.
   */
  jsxToDom?: boolean
}

export function stewie(options?: StewiePluginOptions): Plugin {
  return {
    name: 'stewie',

    // Configure esbuild's jsxImportSource so JSX in .tsx files compiles to
    // @stewie-js/core's descriptor runtime without relying on per-file pragma comments.
    config() {
      return {
        esbuild: {
          jsxImportSource: '@stewie-js/core',
        },
      }
    },

    // Transform .tsx files through the Stewie compiler
    transform(code: string, id: string, transformOptions?: { ssr?: boolean }) {
      if (!id.endsWith('.tsx')) return null

      const isDev = process.env.NODE_ENV !== 'production'

      const result = compile(code, {
        filename: id,
        dev: isDev,
        sourcemap: true,
        inlineSourcemap: isDev,
        jsxToDom: options?.jsxToDom,
      })

      // Surface compiler errors to Vite's error overlay
      if (result.errors.length > 0) {
        const firstError = result.errors[0]
        this.error({
          message: firstError.message,
          loc: {
            file: id,
            line: firstError.line,
            column: firstError.column - 1, // Vite uses 0-based columns
          },
        })
      }

      // Log warnings
      for (const warning of result.warnings) {
        this.warn({
          message: warning.message,
          loc: {
            file: id,
            line: warning.line,
            column: warning.column - 1,
          },
        })
      }

      return {
        code: result.code,
        map: result.map ? JSON.parse(result.map) : null,
      }
    },

    // HMR: recompile changed .tsx files, preserve component state
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith('.tsx')) return
      // Vite's default HMR handles module invalidation;
      // we just need to ensure the transform runs on the new content.
      // Return undefined to let Vite handle the HMR update normally
      // (our transform hook will fire again when the module is re-requested).
      return
    },

    transformIndexHtml: {
      order: 'post' as const,
      handler(_html: string, ctx: { server?: unknown }) {
        if (!ctx.server) return // prod build — skip
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            children: `import('@stewie-js/devtools').then(function(m){ m.initDevtools() }).catch(function(){})`,
            injectTo: 'body' as const,
          },
        ]
      },
    },
  }
}
