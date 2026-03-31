// assertions.ts — signal/store assertion helpers

import type { Signal } from '@stewie-js/core';

// Assert that a signal has the expected value (strict equality)
export function assertSignal<T>(sig: Signal<T>, expected: T): void {
  const actual = sig();
  if (actual !== expected) {
    throw new Error(`Expected signal value ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Recursive deep equality — handles primitives, arrays, and plain objects
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

// Assert that a store path has the expected value.
// path is dot-separated: 'a.b.c'
// Uses deep equality so objects and arrays are compared by value, not reference.
export function assertStore<T extends object>(storeObj: T, path: string, expected: unknown): void {
  const keys = path.split('.');
  let value: unknown = storeObj;
  for (const key of keys) {
    value = (value as Record<string, unknown>)[key];
  }
  if (!deepEqual(value, expected)) {
    throw new Error(`Expected store.${path} to be ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
  }
}
