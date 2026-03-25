// @stewie-js/server — WinterCG-compatible SSR renderer
export const version = '0.1.0'

export { renderToString } from './renderer.js'
export { renderToStream } from './stream.js'
export {
  createHydrationRegistry,
  HydrationRegistryContext,
  useHydrationRegistry,
} from './hydration.js'
export type { RenderOptions, RenderToStringOptions, RenderToStreamOptions, RenderResult } from './types.js'
