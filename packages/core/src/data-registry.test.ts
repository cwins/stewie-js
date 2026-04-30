import { describe, it, expect } from 'vitest';
import { createDataRegistry, dataRegistryKey } from './data-registry.js';
import { reactiveScope } from './reactive.js';

describe('DataRegistry', () => {
  it('roundtrips set/has/get/serialize/hydrate', () => {
    reactiveScope(() => {
      const r = createDataRegistry();
      expect(r.has('a')).toBe(false);
      r.set('a', { x: 1 });
      expect(r.has('a')).toBe(true);
      expect(r.get('a')).toEqual({ x: 1 });

      const blob = r.serialize();

      const r2 = createDataRegistry();
      r2.hydrate(blob);
      expect(r2.get('a')).toEqual({ x: 1 });
    });
  });

  it('serializeByKey / hydrateByKey roundtrip a single entry', () => {
    reactiveScope(() => {
      const r = createDataRegistry();
      r.set('user:1', { name: 'Ada' });
      r.set('user:2', { name: 'Bob' });

      const onlyOne = r.serializeByKey('user:1');

      const r2 = createDataRegistry();
      r2.hydrateByKey('user:1', onlyOne);
      expect(r2.has('user:1')).toBe(true);
      expect(r2.has('user:2')).toBe(false);
      expect(r2.get('user:1')).toEqual({ name: 'Ada' });
    });
  });
});

describe('dataRegistryKey', () => {
  it('produces stable keys regardless of object property order', () => {
    expect(dataRegistryKey('def', { a: 1, b: 2 })).toBe(dataRegistryKey('def', { b: 2, a: 1 }));
  });

  it('distinguishes different defIds and arg shapes', () => {
    expect(dataRegistryKey('a', 1)).not.toBe(dataRegistryKey('b', 1));
    expect(dataRegistryKey('a', 1)).not.toBe(dataRegistryKey('a', 2));
    expect(dataRegistryKey('a', { id: 1 })).not.toBe(dataRegistryKey('a', { id: '1' }));
  });

  it('handles null, undefined, arrays', () => {
    expect(typeof dataRegistryKey('x', null)).toBe('string');
    expect(typeof dataRegistryKey('x', undefined)).toBe('string');
    expect(dataRegistryKey('x', [1, 2, 3])).toBe(dataRegistryKey('x', [1, 2, 3]));
    expect(dataRegistryKey('x', [1, 2])).not.toBe(dataRegistryKey('x', [2, 1]));
  });
});
