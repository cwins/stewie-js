import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so dist/ can be served from any path in the benchmark runner
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Single-file output: the benchmark runner serves dist/index.html
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@stewie-js/core',
  },
})
