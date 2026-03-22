import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Point workspace packages to their TypeScript source so Vite
      // compiles them alongside the example without needing a separate build step.
      '@stewie/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
})
