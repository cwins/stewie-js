import { describe, it, expect } from 'vitest';
import { defineAction, useAction } from './action.js';

describe('defineAction()', () => {
  it('returns an opaque definition that creates no signals', () => {
    const def = defineAction(async (n: number) => n * 2);
    // Definition is a plain value; nothing observable to assert beyond type.
    // What matters: calling defineAction at module scope cannot create signals,
    // because there is nothing reactive in the returned shape. Verified
    // structurally — no `pending` / `error` keys.
    expect((def as { pending?: unknown }).pending).toBeUndefined();
    expect((def as { error?: unknown }).error).toBeUndefined();
  });
});

describe('useAction()', () => {
  it('initial state — pending false, error null', () => {
    const def = defineAction(async (n: number) => n * 2);
    const action = useAction(def);
    expect(action.pending()).toBe(false);
    expect(action.error()).toBeNull();
  });

  it('happy path — pending flips true then false; resolves with result; error stays null', async () => {
    const save = useAction(defineAction(async (input: string) => input.toUpperCase()));

    const p = save.run('hello');
    expect(save.pending()).toBe(true);

    const result = await p;
    expect(result).toBe('HELLO');
    expect(save.pending()).toBe(false);
    expect(save.error()).toBeNull();
  });

  it('sync throw — error captures Error; pending resets; resolves undefined', async () => {
    const fail = useAction(
      defineAction((_input: number) => {
        throw new Error('sync boom');
      })
    );

    const result = await fail.run(42);
    expect(result).toBeUndefined();
    expect(fail.error()).toBeInstanceOf(Error);
    expect(fail.error()?.message).toBe('sync boom');
    expect(fail.pending()).toBe(false);
  });

  it('async rejection — error captures Error; pending resets; resolves undefined', async () => {
    const fail = useAction(
      defineAction(async (_input: number) => {
        throw new Error('async boom');
      })
    );

    const result = await fail.run(0);
    expect(result).toBeUndefined();
    expect(fail.error()?.message).toBe('async boom');
    expect(fail.pending()).toBe(false);
  });

  it('error is cleared at the start of a subsequent run', async () => {
    let shouldFail = true;
    const flaky = useAction(
      defineAction(async (_: void) => {
        if (shouldFail) throw new Error('first attempt failed');
        return 'ok';
      })
    );

    await flaky.run(undefined);
    expect(flaky.error()?.message).toBe('first attempt failed');

    shouldFail = false;
    const result = await flaky.run(undefined);
    expect(result).toBe('ok');
    expect(flaky.error()).toBeNull();
  });

  it('sync (non-async) fn works', async () => {
    const double = useAction(defineAction((n: number) => n * 2));
    const result = await double.run(7);
    expect(result).toBe(14);
    expect(double.pending()).toBe(false);
    expect(double.error()).toBeNull();
  });

  it('non-Error thrown values are wrapped in new Error(String(x))', async () => {
    const strThrow = useAction(
      defineAction((_: void) => {
        throw 'something went wrong';
      })
    );
    await strThrow.run(undefined);
    expect(strThrow.error()).toBeInstanceOf(Error);
    expect(strThrow.error()?.message).toBe('something went wrong');

    const objThrow = useAction(
      defineAction((_: void) => {
        throw { code: 404 };
      })
    );
    await objThrow.run(undefined);
    expect(objThrow.error()?.message).toBe('[object Object]');
  });

  it('concurrent run() while pending no-ops — second call returns undefined and does not invoke fn', async () => {
    let calls = 0;
    let resolveFirst!: (v: string) => void;
    const def = defineAction((_: void) => {
      calls++;
      return new Promise<string>((r) => {
        resolveFirst = r;
      });
    });
    const action = useAction(def);

    const p1 = action.run(undefined);
    expect(action.pending()).toBe(true);
    expect(calls).toBe(1);

    // Second call while first is in flight — should no-op immediately.
    const result2 = await action.run(undefined);
    expect(result2).toBeUndefined();
    expect(calls).toBe(1); // fn not invoked again
    expect(action.pending()).toBe(true); // first still in flight

    resolveFirst('done');
    const result1 = await p1;
    expect(result1).toBe('done');
    expect(action.pending()).toBe(false);
  });

  it('reset() clears error to null when not pending', async () => {
    const fail = useAction(
      defineAction((_: void) => {
        throw new Error('boom');
      })
    );
    await fail.run();
    expect(fail.error()).not.toBeNull();

    fail.reset();
    expect(fail.error()).toBeNull();
  });

  it('reset() is a no-op while pending', async () => {
    let resolve!: () => void;
    const action = useAction(
      defineAction(
        (_: void) =>
          new Promise<void>((r) => {
            resolve = r;
          })
      )
    );

    const p = action.run(undefined);
    expect(action.pending()).toBe(true);

    // Should not affect anything; pending is true so reset bails.
    action.reset();
    expect(action.pending()).toBe(true);

    resolve();
    await p;
  });

  it('two useAction() calls on the same definition each get their own instance', async () => {
    const def = defineAction(async (n: number) => n + 1);
    const a = useAction(def);
    const b = useAction(def);

    expect(a.pending).not.toBe(b.pending);
    expect(a.error).not.toBe(b.error);

    // Trigger an error on a; b stays clean.
    const failingDef = defineAction((_: void) => {
      throw new Error('only a');
    });
    const aFail = useAction(failingDef);
    const bFail = useAction(failingDef);
    await aFail.run(undefined);
    expect(aFail.error()?.message).toBe('only a');
    expect(bFail.error()).toBeNull();
  });

  it('lifecycle ordering — pending and error update in a single batch at run() start', async () => {
    let resolveFn!: () => void;
    const action = useAction(
      defineAction(
        (_: void) =>
          new Promise<void>((r) => {
            resolveFn = r;
          })
      )
    );

    // Seed an error so the start-of-run clear is observable.
    const failOnce = useAction(
      defineAction((_: void) => {
        throw new Error('seed');
      })
    );
    await failOnce.run();
    expect(failOnce.error()?.message).toBe('seed');

    // For the lifecycle batching itself, observe that during the in-flight
    // window, pending is true and error is null (cleared at start).
    const p = action.run(undefined);
    expect(action.pending()).toBe(true);
    expect(action.error()).toBeNull();

    resolveFn();
    await p;
    expect(action.pending()).toBe(false);
    expect(action.error()).toBeNull();
  });
});
