// @stewie-js/server — WinterCG-compatible SSR renderer
export const version = '0.8.0';

export { renderToString, renderToStream } from './stream.js';
export { createHydrationRegistry, HydrationRegistryContext, useHydrationRegistry } from './hydration.js';
export type { RenderOptions, RenderToStringOptions, RenderToStreamOptions, RenderResult } from './types.js';
