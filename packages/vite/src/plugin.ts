import type { Plugin } from 'vite'
import { compile } from '@stewie/compiler'

export interface StewiePluginOptions {
  // Future: custom compiler options
}

export function stewie(options?: StewiePluginOptions): Plugin {
  return {
    name: 'stewie',

    // Transform .tsx files through the Stewie compiler
    transform(code: string, id: string) {
      if (!id.endsWith('.tsx')) return null

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
            column: firstError.column - 1,  // Vite uses 0-based columns
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
  }
}
