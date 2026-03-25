import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@stewie-js/core/dom/jsx-runtime': resolve(__dirname, 'packages/core/src/dom/jsx-runtime.ts'),
      '@stewie-js/core/jsx-dev-runtime': resolve(__dirname, 'packages/core/src/jsx-dev-runtime.ts'),
      '@stewie-js/core/jsx-runtime': resolve(__dirname, 'packages/core/src/jsx-runtime.ts'),
      '@stewie-js/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@stewie-js/compiler': resolve(__dirname, 'packages/compiler/src/index.ts'),
      '@stewie-js/server': resolve(__dirname, 'packages/server/src/index.ts'),
      '@stewie-js/router-spi': resolve(__dirname, 'packages/router-spi/src/index.ts'),
      '@stewie-js/router': resolve(__dirname, 'packages/router/src/index.ts'),
      '@stewie-js/adapter-node': resolve(__dirname, 'packages/adapter-node/src/index.ts'),
      '@stewie-js/testing': resolve(__dirname, 'packages/testing/src/index.ts'),
    },
  },
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.test.tsx',
      'examples/*/src/**/*.test.ts',
      'examples/*/src/**/*.test.tsx',
    ],
    environment: 'node',
  },
})
