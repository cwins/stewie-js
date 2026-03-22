// context-helpers.ts — context mock helpers

import type { Context } from '@stewie/core'
import { provide } from '@stewie/core'

// Run a callback function with a provided context value.
// The context value is available via inject() within fn and any callees.
export function withContext<T, R>(context: Context<T>, value: T, fn: () => R): R {
  return provide(context, value, fn)
}
