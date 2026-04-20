// action.ts — UNSHIPPED PROTOTYPE. Not exported from @stewie-js/core.
//
// This file exists to keep the Work Queue design-testbed work in git while the
// API shape is settled. See ROADMAP.md "Actions / Mutations" for the open
// questions (definition-vs-instance split, naming, relationship to form
// primitives, possible action-routes layer). Tests in action.test.ts validate
// the current shape against the settled semantics so a future redesign can
// reuse what still holds.
//
// KNOWN FOOTGUN in this shape: calling action() at module scope creates
// pending/error signals at module scope, violating the module-scope rule for
// reactive primitives and breaking cross-component reuse. This is the primary
// reason the primitive is unexported — resolving it requires splitting into
// defineAction(fn) (module-scope, no signals) + .use() (component-scope).
//
// action() wraps a mutation function and provides reactive pending/error signals.
// It is a factory, not a reactive effect — safe to call inside or outside a
// reactiveScope. The returned signals are usable in any reactive context.

import { signal } from './reactive.js';
import type { Signal } from './reactive.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Action<I, O> {
  /**
   * True from the moment run() is invoked until fn resolves or rejects.
   * Strictly bounded: does NOT stay true during caller-side post-mutation work.
   */
  pending: Signal<boolean>;
  /**
   * '' when clean. Cleared at the start of every run() call.
   * Set to an error message string on rejection.
   */
  error: Signal<string>;
  /**
   * Invoke the mutation. Never rejects — resolves with the result on success,
   * or undefined on failure. The caller inspects the return value to branch.
   */
  run: (input: I) => Promise<O | undefined>;
}

// ---------------------------------------------------------------------------
// action()
// ---------------------------------------------------------------------------

/**
 * Wraps a mutation function and returns reactive signals for its pending and
 * error state. The returned `run()` method never rejects — callers branch on
 * the return value instead of try/catch.
 *
 * ```ts
 * const save = action((input: UpdateProjectInput) => updateProject(id, input));
 *
 * const handleSubmit = async (e: Event) => {
 *   e.preventDefault();
 *   const result = await save.run({ name: $name(), description: $desc() });
 *   if (result) await router.navigate(`/projects/${result.id}`);
 * };
 * ```
 *
 * **Concurrent run() calls:** both run concurrently. `pending` is true while
 * any call is in flight (tracked with a counter). `error` reflects the last
 * settled rejection — if multiple calls fail, whichever settles last wins.
 * This is the simplest correct behavior; callers that need serialized mutations
 * should guard with the `pending` signal before calling run() again.
 */
export function action<I, O>(fn: (input: I) => Promise<O> | O): Action<I, O> {
  const pending = signal<boolean>(false);
  const error = signal<string>('');

  // Tracks how many run() calls are currently in flight. pending is true
  // while this is > 0, allowing correct behavior under concurrent calls.
  let _inFlight = 0;

  async function run(input: I): Promise<O | undefined> {
    _inFlight++;
    pending.set(true);
    error.set('');

    try {
      const result = await fn(input);
      return result;
    } catch (err) {
      error.set(err instanceof Error ? err.message : String(err));
      return undefined;
    } finally {
      _inFlight--;
      if (_inFlight === 0) {
        pending.set(false);
      }
    }
  }

  return { pending, error, run };
}
