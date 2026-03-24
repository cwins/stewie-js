import { BuildEnvironmentOptions, defineConfig } from 'vite'
import { stewie } from '@stewie/vite'

const ssrBuild: BuildEnvironmentOptions = {
  manifest: true,
  ssr: true,
  outDir: 'dist/server',
  ssrManifest: true,
  copyPublicDir: false,
  emptyOutDir: true,
  target: 'es2022',
  rollupOptions: {
    input: 'src/app.tsx',
    output: {
      entryFileNames: '[name].js',
      chunkFileNames: 'assets/[name].js',
      assetFileNames: 'assets/[name].[ext]',
      format: 'cjs'
    }
  }
}

const clientBuild: BuildEnvironmentOptions = {
  manifest: true,
  outDir: 'dist/client',
  ssrManifest: true,
  copyPublicDir: true,
  emptyOutDir: true,
  target: 'es2022',
  minify: true,
  rollupOptions: {
    input: 'index.html',
    output: {
      entryFileNames: 'static/[name].js',
      chunkFileNames: 'static/assets/[name].[hash].js',
      assetFileNames: 'static/assets/[name].[ext]'
    }
  }
}

export default defineConfig((configEnv) => {
  return {
    plugins: [stewie()],
    build: configEnv.isSsrBuild ? ssrBuild : clientBuild
  }
})
