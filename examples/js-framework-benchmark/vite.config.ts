// import { defineConfig } from 'vite';
import { defineConfig, stewie } from '@stewie-js/vite';

export default defineConfig({
  // Relative base so dist/ can be served from any path in the benchmark runner
  base: './',
  root: 'src',
  build: {
    emptyOutDir: true,
    outDir: '../dist',
    target: 'es2022',
    // Single-file output: the benchmark runner serves dist/index.html
    rollupOptions: {
      input: 'src/index.html',
      output: {
        manualChunks: undefined,
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
        format: 'esm'
      }
    }
  },
  plugins: [stewie()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@stewie-js/core'
  }
});
