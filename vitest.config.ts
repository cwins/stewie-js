import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@stewie/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@stewie/compiler': resolve(__dirname, 'packages/compiler/src/index.ts'),
      '@stewie/server': resolve(__dirname, 'packages/server/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
    environment: 'node',
  },
})
