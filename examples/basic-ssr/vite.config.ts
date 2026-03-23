import { defineConfig } from 'vite'
import { stewie } from '@stewie/vite'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Resolve workspace packages to their TypeScript source so we don't need
// to rebuild them before running this example.
const pkg = (name: string) => resolve(__dirname, '../../packages', name, 'src/index.ts')

export default defineConfig({
  plugins: [stewie()],
  resolve: {
    // More-specific aliases must come before less-specific ones.
    alias: [
      {
        find: '@stewie/core/dom/jsx-runtime',
        replacement: resolve(__dirname, '../../packages/core/src/dom/jsx-runtime.ts'),
      },
      { find: '@stewie/core', replacement: pkg('core') },
      { find: '@stewie/server', replacement: pkg('server') },
      { find: '@stewie/router', replacement: pkg('router') },
      { find: '@stewie/testing', replacement: pkg('testing') },
    ],
  },
})
