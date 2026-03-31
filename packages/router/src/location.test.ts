import { describe, it, expect } from 'vitest';
import { effect } from '@stewie-js/core';
import { createLocationStore, parseQuery, parseUrl } from './location.js';

describe('parseQuery', () => {
  it('parses key=value pairs', () => {
    expect(parseQuery('?foo=bar&baz=qux')).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it('parses without leading ?', () => {
    expect(parseQuery('foo=bar')).toEqual({ foo: 'bar' });
  });

  it('returns empty object for empty string', () => {
    expect(parseQuery('')).toEqual({});
  });

  it('handles URL encoded values', () => {
    expect(parseQuery('?name=hello%20world')).toEqual({ name: 'hello world' });
  });

  it('handles keys without values', () => {
    const result = parseQuery('?flag');
    expect(result).toHaveProperty('flag');
  });

  it('handles single param', () => {
    expect(parseQuery('?tab=info')).toEqual({ tab: 'info' });
  });
});

describe('parseUrl', () => {
  it('parses pathname only', () => {
    const result = parseUrl('/path');
    expect(result.pathname).toBe('/path');
    expect(result.query).toEqual({});
    expect(result.hash).toBe('');
  });

  it('parses pathname with query and hash', () => {
    const result = parseUrl('/path?a=1#hash');
    expect(result.pathname).toBe('/path');
    expect(result.query).toEqual({ a: '1' });
    expect(result.hash).toBe('hash');
  });

  it('parses root path', () => {
    const result = parseUrl('/');
    expect(result.pathname).toBe('/');
    expect(result.query).toEqual({});
    expect(result.hash).toBe('');
  });

  it('parses hash without query', () => {
    const result = parseUrl('/page#section');
    expect(result.pathname).toBe('/page');
    expect(result.query).toEqual({});
    expect(result.hash).toBe('section');
  });

  it('parses complex URL', () => {
    const result = parseUrl('/users/42?tab=info&show=true#comments');
    expect(result.pathname).toBe('/users/42');
    expect(result.query).toEqual({ tab: 'info', show: 'true' });
    expect(result.hash).toBe('comments');
  });
});

describe('createLocationStore', () => {
  it('creates store with root defaults', () => {
    const loc = createLocationStore('/');
    expect(loc.pathname).toBe('/');
    expect(loc.params).toEqual({});
    expect(loc.query).toEqual({});
    expect(loc.hash).toBe('');
  });

  it('defaults to / when no initialUrl provided', () => {
    const loc = createLocationStore();
    expect(loc.pathname).toBe('/');
  });

  it('parses complex initial URL', () => {
    const loc = createLocationStore('/users/42?tab=info#section');
    expect(loc.pathname).toBe('/users/42');
    expect(loc.query).toEqual({ tab: 'info' });
    expect(loc.hash).toBe('section');
    expect(loc.params).toEqual({});
  });

  it('is a reactive store (properties can be read and updated)', () => {
    const loc = createLocationStore('/home');
    expect(loc.pathname).toBe('/home');

    // Update a property
    loc.pathname = '/about';
    expect(loc.pathname).toBe('/about');
  });

  it('is a reactive store (property updates are independent)', () => {
    const loc = createLocationStore('/home?foo=bar');
    let pathnameRunCount = 0;
    let queryRunCount = 0;

    const disposePathname = effect(() => {
      // Subscribe to pathname only
      const _ = loc.pathname;
      pathnameRunCount++;
    });

    const disposeQuery = effect(() => {
      // Subscribe to query only
      const _ = loc.query;
      queryRunCount++;
    });

    // Initial run
    expect(pathnameRunCount).toBe(1);
    expect(queryRunCount).toBe(1);

    // Change pathname only — query effect should NOT re-run
    loc.pathname = '/new-path';
    expect(pathnameRunCount).toBe(2);
    expect(queryRunCount).toBe(1); // unchanged

    // Change query only — pathname effect should NOT re-run
    loc.query = { tab: 'settings' };
    expect(pathnameRunCount).toBe(2); // unchanged
    expect(queryRunCount).toBe(2);

    disposePathname();
    disposeQuery();
  });
});
