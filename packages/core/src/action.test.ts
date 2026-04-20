import { describe, it, expect } from 'vitest';
import { action } from './action.js';

// ---------------------------------------------------------------------------
// action() — mutation primitive
// ---------------------------------------------------------------------------

describe('action()', () => {
  // 1. Happy path
  it('resolves with the result; pending flips true then false; error stays empty', async () => {
    const save = action(async (input: string) => input.toUpperCase());

    expect(save.pending()).toBe(false);
    expect(save.error()).toBe('');

    const p = save.run('hello');
    expect(save.pending()).toBe(true);

    const result = await p;
    expect(result).toBe('HELLO');
    expect(save.pending()).toBe(false);
    expect(save.error()).toBe('');
  });

  // 2. Sync throw — run resolves undefined; error gets message; pending returns to false
  it('sync throw — run resolves undefined; error captures message; pending resets', async () => {
    const fail = action((_input: number) => {
      throw new Error('sync boom');
    });

    const result = await fail.run(42);
    expect(result).toBeUndefined();
    expect(fail.error()).toBe('sync boom');
    expect(fail.pending()).toBe(false);
  });

  // 3. Async rejection — same outcome as sync throw
  it('async rejection — run resolves undefined; error captures message; pending resets', async () => {
    const fail = action(async (_input: number) => {
      throw new Error('async boom');
    });

    const result = await fail.run(0);
    expect(result).toBeUndefined();
    expect(fail.error()).toBe('async boom');
    expect(fail.pending()).toBe(false);
  });

  // 4. Error clears on a subsequent successful run
  it('error is cleared at the start of a subsequent successful run', async () => {
    let shouldFail = true;
    const flaky = action(async (_: void) => {
      if (shouldFail) throw new Error('first attempt failed');
      return 'ok';
    });

    await flaky.run(undefined);
    expect(flaky.error()).toBe('first attempt failed');

    shouldFail = false;
    const result = await flaky.run(undefined);
    expect(result).toBe('ok');
    expect(flaky.error()).toBe('');
  });

  // 5. pending is true while fn is in flight (observed via deferred promise)
  it('pending is true while fn is in flight', async () => {
    let resolve!: (v: string) => void;
    const deferred = new Promise<string>((r) => {
      resolve = r;
    });

    const slow = action((_: void) => deferred);

    const p = slow.run(undefined);
    expect(slow.pending()).toBe(true);

    resolve('done');
    await p;
    expect(slow.pending()).toBe(false);
  });

  // 6. Sync fn (no async/await in the fn body) works correctly
  it('sync fn (non-async) works correctly', async () => {
    const double = action((n: number) => n * 2);

    const result = await double.run(7);
    expect(result).toBe(14);
    expect(double.pending()).toBe(false);
    expect(double.error()).toBe('');
  });

  // 7. Non-Error thrown values are coerced to strings sensibly
  it('non-Error thrown string is coerced via String()', async () => {
    const strThrow = action((_: void) => {
      throw 'something went wrong';
    });
    await strThrow.run(undefined);
    expect(strThrow.error()).toBe('something went wrong');
  });

  it('non-Error thrown object is coerced via String()', async () => {
    const objThrow = action((_: void) => {
      throw { code: 404 };
    });
    await objThrow.run(undefined);
    expect(objThrow.error()).toBe('[object Object]');
  });

  // 8. Two concurrent run() calls — both execute concurrently.
  //    pending stays true until both settle; error reflects whichever failure
  //    settled last. This is documented behavior: callers that need serialized
  //    mutations should guard with the pending signal before calling run() again.
  it('two concurrent run() calls — pending true until both settle', async () => {
    let resolveFirst!: (v: number) => void;
    let resolveSecond!: (v: number) => void;

    const first = new Promise<number>((r) => {
      resolveFirst = r;
    });
    const second = new Promise<number>((r) => {
      resolveSecond = r;
    });

    let call = 0;
    const multi = action((_: void) => {
      call++;
      return call === 1 ? first : second;
    });

    // Fire both concurrently
    const p1 = multi.run(undefined);
    const p2 = multi.run(undefined);

    expect(multi.pending()).toBe(true);

    // Resolve first; pending should still be true (second is in flight)
    resolveFirst(1);
    await p1;
    expect(multi.pending()).toBe(true);

    // Resolve second; now both are done
    resolveSecond(2);
    const result2 = await p2;
    expect(multi.pending()).toBe(false);
    expect(result2).toBe(2);
    expect(multi.error()).toBe('');
  });

  it('concurrent calls — error reflects last settled rejection', async () => {
    let rejectFirst!: (e: unknown) => void;
    let rejectSecond!: (e: unknown) => void;

    const first = new Promise<never>((_, r) => {
      rejectFirst = r;
    });
    const second = new Promise<never>((_, r) => {
      rejectSecond = r;
    });

    let call = 0;
    const multi = action((_: void) => {
      call++;
      return call === 1 ? first : second;
    });

    const p1 = multi.run(undefined);
    const p2 = multi.run(undefined);

    // First settles with an error
    rejectFirst(new Error('first error'));
    await p1;
    // error is set from first rejection; second still in flight
    expect(multi.error()).toBe('first error');
    expect(multi.pending()).toBe(true);

    // Second settles with a different error — wins
    rejectSecond(new Error('second error'));
    await p2;
    expect(multi.error()).toBe('second error');
    expect(multi.pending()).toBe(false);
  });
});
