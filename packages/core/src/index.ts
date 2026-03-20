// @stewie/core — reactivity primitives, JSX runtime, context

export const version = '0.0.1'

export type { Signal, Computed, Dispose, Scope, Subscribable, Subscriber } from './reactive.js'
export {
  signal,
  computed,
  effect,
  batch,
  getCurrentScope,
  createScope,
  _allowReactiveCreation,
  _setAllowReactiveCreation,
} from './reactive.js'

export { store } from './store.js'
