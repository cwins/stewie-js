// @stewie/server — WinterCG-compatible SSR renderer
export const version = '0.0.1'

export { renderToString } from './renderer.js'
export { renderToStream } from './stream.js'
export {
  createHydrationRegistry,
  HydrationRegistryContext,
  useHydrationRegistry,
} from './hydration.js'
export type { RenderOptions, RenderToStringOptions, RenderToStreamOptions } from './types.js'
