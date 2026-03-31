export const version = '0.4.0'

export { stewie } from './plugin.js'
export type { StewiePluginOptions } from './plugin.js'

// Re-export defineConfig with Stewie defaults pre-applied
export { defineConfig } from 'vite'

import { defineConfig as viteDefineConfig, type UserConfig } from 'vite'
import { stewie } from './plugin.js'

export function defineStewieConfig(config?: UserConfig): UserConfig {
  return viteDefineConfig({
    ...config,
    plugins: [stewie(), ...(config?.plugins ?? [])],
  })
}
