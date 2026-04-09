// context-helpers.ts — context mock helpers

import type { Context } from '@stewie-js/core';
import { provide } from '@stewie-js/core';

// Run a callback function with a provided context value.
// The context value is available via consume() within fn and any callees.
export function withContext<T, R>(context: Context<T>, value: T, fn: () => R): R {
  return provide(context, value, fn);
}
