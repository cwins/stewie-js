import { describe, it, expect } from 'vitest';
import { createContext, provide, inject, captureContext, runWithContext, type ContextSnapshot } from './context.js';

describe('createContext', () => {
  it('returns a context token with the default value', () => {
    const ctx = createContext('hello');
    expect(ctx.defaultValue).toBe('hello');
    expect(typeof ctx.id).toBe('symbol');
  });

  it('returns a context token with undefined default when no argument', () => {
    const ctx = createContext<number>();
    expect(ctx.defaultValue).toBeUndefined();
  });
});

describe('inject', () => {
  it('returns the default value when no provider', () => {
    const ctx = createContext(42);
    expect(inject(ctx)).toBe(42);
  });

  it('throws when no provider and no default', () => {
    const ctx = createContext<string>();
    expect(() => inject(ctx)).toThrow('[stewie] inject() called with no matching provider and no default value');
  });
});

describe('provide + inject', () => {
  it('returns the provided value inside the callback', () => {
    const ctx = createContext('default');
    let result: string | undefined;
    provide(ctx, 'provided', () => {
      result = inject(ctx);
    });
    expect(result).toBe('provided');
  });

  it('nested provide — innermost wins', () => {
    const ctx = createContext('outer');
    let inner: string | undefined;
    let outer: string | undefined;
    provide(ctx, 'outer', () => {
      outer = inject(ctx);
      provide(ctx, 'inner', () => {
        inner = inject(ctx);
      });
    });
    expect(outer).toBe('outer');
    expect(inner).toBe('inner');
  });

  it('restores previous value after fn completes', () => {
    const ctx = createContext('default');
    provide(ctx, 'provided', () => {
      // inside the provider
    });
    // After the provider, falls back to default
    expect(inject(ctx)).toBe('default');
  });

  it('restores even if fn throws', () => {
    const ctx = createContext('default');
    try {
      provide(ctx, 'provided', () => {
        throw new Error('oops');
      });
    } catch {
      // expected
    }
    // Should have restored: inject returns default, not throw
    expect(inject(ctx)).toBe('default');
  });

  it('returns value from provide', () => {
    const ctx = createContext(0);
    const result = provide(ctx, 10, () => {
      return inject(ctx) * 2;
    });
    expect(result).toBe(20);
  });
});

describe('Context.Provider', () => {
  it('createContext returns a Provider with _isProvider marker', () => {
    const ctx = createContext('default');
    expect(ctx.Provider).toBeDefined();
    expect((ctx.Provider as { _isProvider: boolean })._isProvider).toBe(true);
    expect((ctx.Provider as { _context: typeof ctx })._context).toBe(ctx);
  });
});

describe('captureContext + runWithContext', () => {
  it('captures empty snapshot when no contexts are active', () => {
    const snap = captureContext();
    expect(snap.size).toBe(0);
  });

  it('captures active context values', () => {
    const ctx = createContext('default');
    let snap = new Map();
    provide(ctx, 'hello', () => {
      snap = captureContext() as Map<symbol, unknown>;
    });
    expect(snap.get(ctx.id)).toBe('hello');
  });

  it('restores context from snapshot in runWithContext', () => {
    const ctx = createContext('default');
    let snap = new Map();
    provide(ctx, 'captured', () => {
      snap = captureContext() as Map<symbol, unknown>;
    });
    // Outside the provide, context is gone
    expect(inject(ctx)).toBe('default');
    // runWithContext restores it
    let result: string | undefined;
    runWithContext(snap, () => {
      result = inject(ctx);
    });
    expect(result).toBe('captured');
    // After runWithContext, context is gone again
    expect(inject(ctx)).toBe('default');
  });

  it('runWithContext does not leak context after fn completes', () => {
    const ctx = createContext('default');
    const snap: ContextSnapshot = new Map([[ctx.id, 'injected']]);
    runWithContext(snap, () => {
      /* no-op */
    });
    expect(inject(ctx)).toBe('default');
  });

  it('runWithContext restores even if fn throws', () => {
    const ctx = createContext('default');
    const snap: ContextSnapshot = new Map([[ctx.id, 'injected']]);
    try {
      runWithContext(snap, () => {
        throw new Error('oops');
      });
    } catch {
      /* expected */
    }
    expect(inject(ctx)).toBe('default');
  });

  it('runWithContext works with multiple contexts', () => {
    const ctxA = createContext('a-default');
    const ctxB = createContext('b-default');
    const snap: ContextSnapshot = new Map([
      [ctxA.id, 'a-value'],
      [ctxB.id, 'b-value']
    ]);
    let a: string | undefined;
    let b: string | undefined;
    runWithContext(snap, () => {
      a = inject(ctxA);
      b = inject(ctxB);
    });
    expect(a).toBe('a-value');
    expect(b).toBe('b-value');
  });
});
