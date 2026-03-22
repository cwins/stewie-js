import type { Plugin } from 'vite'
import { compile } from '@stewie/compiler'

export interface StewiePluginOptions {
  // Future: custom compiler options
}

// Pragma injected at the top of every client-side .tsx file.
// Tells esbuild (Vite's TS transform) to use the DOM JSX runtime so that
// JSX compiles to real DOM element creation instead of descriptor objects.
const DOM_JSX_PRAGMA = '/** @jsxImportSource @stewie/core/dom */\n'

export function stewie(_options?: StewiePluginOptions): Plugin {
  return {
    name: 'stewie',

    // Transform .tsx files through the Stewie compiler
    transform(code: string, id: string, options?: { ssr?: boolean }) {
      if (!id.endsWith('.tsx')) return null

      const isSSR = options?.ssr ?? false
      const isDev = process.env.NODE_ENV !== 'production'

      const result = compile(code, {
        filename: id,
        dev: isDev,
        sourcemap: true,
        inlineSourcemap: isDev,
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

      // For client builds, prepend the DOM JSX pragma so esbuild routes JSX
      // through @stewie/core/dom/jsx-runtime (creates real DOM nodes).
      // For SSR builds, keep the default descriptor runtime.
      const output = isSSR ? result.code : DOM_JSX_PRAGMA + result.code

      return {
        code: output,
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
  }
}
