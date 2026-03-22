import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@stewie/core/dom/jsx-runtime': resolve(__dirname, 'packages/core/dom/jsx-runtime.ts'),
      '@stewie/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@stewie/compiler': resolve(__dirname, 'packages/compiler/src/index.ts'),
      '@stewie/server': resolve(__dirname, 'packages/server/src/index.ts'),
      '@stewie/router-spi': resolve(__dirname, 'packages/router-spi/src/index.ts'),
      '@stewie/router': resolve(__dirname, 'packages/router/src/index.ts'),
      '@stewie/adapter-node': resolve(__dirname, 'packages/adapter-node/src/index.ts'),
      '@stewie/testing': resolve(__dirname, 'packages/testing/src/index.ts'),
    },
  },
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.tsx',
      'packages/*/dom/**/*.test.ts',
      'packages/*/dom/**/*.test.tsx',
      'examples/*/src/**/*.test.ts',
      'examples/*/src/**/*.test.tsx',
    ],
    environment: 'node',
  },
})
