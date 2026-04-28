// action.ts — defineAction + useAction (settled write-side mutation primitive).
//
// defineAction(fn) returns an opaque definition that creates no signals — safe
// to call at module scope and to share across files. useAction(def) is a free
// function (matches consume(Context)) that creates the per-component instance
// owning { pending, error } signals scoped to the calling component.
//
// See CLAUDE.md "Actions / mutations API shape" and ROADMAP.md "Actions /
// Mutations" for the full settled spec.

import { batch, signal } from './reactive.js';
import type { Signal } from './reactive.js';

// Phantom type-only brand. The variance markers tie I/O into the type so two
// definitions with different signatures aren't assignable to each other.
declare const ActionBrand: unique symbol;

export interface ActionDefinition<I, O> {
  readonly [ActionBrand]: [(input: I) => void, () => O];
}

// Internal runtime carrier. The brand symbol is type-only; the actual function
// is held under a private symbol so userland cannot read or replace it.
const FN = Symbol('stewie.action.fn');

interface InternalActionDefinition<I, O> extends ActionDefinition<I, O> {
  readonly [FN]: (input: I) => Promise<O> | O;
}

/**
 * Status of the most recent run() invocation.
 * - 'idle': run() has never been called (or reset() cleared the state)
 * - 'success': last run resolved successfully
 * - 'error': last run threw; `error` signal holds the caught Error
 * - 'blocked': last run was rejected because another run was in flight
 */
export type RunStatus = 'idle' | 'success' | 'error' | 'blocked';

interface ActionBase<O> {
  /**
   * `true` while a run() invocation is in flight. Strictly bounded by the
   * mutation itself — does NOT extend through caller-side post-mutation work.
   */
  pending: Signal<boolean>;
  /**
   * `null` when clean. Cleared at the start of every run() call. Set to the
   * caught Error on rejection (non-Error values are wrapped in `new Error()`).
   */
  error: Signal<Error | null>;
  /**
   * Status of the most recent run() invocation. Use this to branch after
   * `await action.run()` — works for void-returning actions where the
   * `result === undefined` idiom collides with success-void.
   */
  lastRun: Signal<RunStatus>;
  /**
   * Clear `error` to `null` and `lastRun` to `'idle'`. No-op while `pending`
   * is `true`. Use to dismiss a persistent error UI without retrying.
   */
  reset: () => void;
  // Marker so the conditional run() type below can distinguish on O even
  // when callers parameterize Action<...> manually. Phantom — never read.
  readonly [ActionOutputBrand]?: O;
}

declare const ActionOutputBrand: unique symbol;

/**
 * Per-component action instance. `run()` never rejects: resolves with the
 * action's return value on success, or `undefined` on caught error / when
 * blocked by an in-flight call. When `I` is `void`, `run()` takes no
 * argument.
 */
export type Action<I, O> = ActionBase<O> &
  ([I] extends [void] ? { run: () => Promise<O | undefined> } : { run: (input: I) => Promise<O | undefined> });

export function defineAction<O>(fn: () => Promise<O> | O): ActionDefinition<void, O>;
export function defineAction<I, O>(fn: (input: I) => Promise<O> | O): ActionDefinition<I, O>;
export function defineAction<I, O>(fn: (input: I) => Promise<O> | O): ActionDefinition<I, O> {
  return { [FN]: fn } as InternalActionDefinition<I, O>;
}

export function useAction<I, O>(def: ActionDefinition<I, O>): Action<I, O> {
  const fn = (def as InternalActionDefinition<I, O>)[FN];
  const pending = signal<boolean>(false);
  const error = signal<Error | null>(null);
  const lastRun = signal<RunStatus>('idle');

  async function run(input: I): Promise<O | undefined> {
    if (pending.peek()) {
      lastRun.set('blocked');
      return undefined;
    }

    batch(() => {
      pending.set(true);
      error.set(null);
    });

    try {
      const result = await fn(input);
      batch(() => {
        pending.set(false);
        lastRun.set('success');
      });
      return result;
    } catch (err) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      batch(() => {
        pending.set(false);
        error.set(errObj);
        lastRun.set('error');
      });
      return undefined;
    }
  }

  function reset(): void {
    if (!pending.peek()) {
      batch(() => {
        error.set(null);
        lastRun.set('idle');
      });
    }
  }

  return { pending, error, lastRun, run, reset } as unknown as Action<I, O>;
}
