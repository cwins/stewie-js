// @stewie-js/testing — test utilities for mounting components, querying the DOM,
// and asserting reactive state.

export const version = '0.4.0';

export { mount } from './mount.js';
export type { MountResult, MountOptions, ElementHandle } from './mount.js';

export { assertSignal, assertStore } from './assertions.js';

export { flushEffects } from './effects.js';

export { renderToString } from './ssr.js';

export { withContext } from './context-helpers.js';

export { findByText, findByTestId, findByRole } from './queries.js';
