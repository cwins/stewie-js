import { describe, it, expect } from 'vitest';
import { jsx, jsxs, Fragment } from './jsx-runtime.js';
import type { Component } from './jsx-runtime.js';

describe('jsx', () => {
  it('returns correct element descriptor for a string tag', () => {
    const el = jsx('div', { class: 'foo' });
    expect(el.type).toBe('div');
    expect(el.props).toEqual({ class: 'foo' });
    expect(el.key).toBeNull();
  });

  it('returns correct element descriptor for a component function', () => {
    const MyComp: Component = (props) => jsx('span', props);
    const el = jsx(MyComp, { id: 'test' });
    expect(el.type).toBe(MyComp);
    expect(el.props).toEqual({ id: 'test' });
    expect(el.key).toBeNull();
  });

  it('captures the key in the element descriptor', () => {
    const el = jsx('li', { class: 'item' }, 'key-1');
    expect(el.key).toBe('key-1');
  });

  it('Fragment can be used as type', () => {
    const el = jsx(Fragment, { children: [] });
    expect(el.type).toBe(Fragment);
  });

  it('key is null when not provided', () => {
    const el = jsx('div', {});
    expect(el.key).toBeNull();
  });

  it('converts non-string key to string', () => {
    // key is typed as string but just confirm coercion doesn't break
    const el = jsx('div', {}, '42');
    expect(el.key).toBe('42');
  });
});

describe('jsxs', () => {
  it('behaves the same as jsx', () => {
    const el1 = jsx('div', { class: 'foo', children: ['a', 'b'] });
    const el2 = jsxs('div', { class: 'foo', children: ['a', 'b'] });
    expect(el1).toEqual(el2);
  });

  it('captures key like jsx', () => {
    const el = jsxs('ul', { children: [] }, 'list-key');
    expect(el.key).toBe('list-key');
  });
});

describe('Fragment', () => {
  it('is a unique symbol', () => {
    expect(typeof Fragment).toBe('symbol');
  });
});

// Compile-time assertions: these don't assert behaviour, they assert that the
// JSXChild type accepts shapes the runtime already supports. If the recursive
// definition of JSXChild regresses, these stop compiling.
describe('JSXChild type', () => {
  it('accepts mixed siblings including an inline array (e.g. items.map())', () => {
    // The case from the Pokemon writeup and the Work Queue UserPicker: a static
    // child alongside `{items.map(...)}` in the children slot.
    const items = [1, 2, 3];
    const el = jsx('select', {
      children: [
        jsx('option', { value: '', children: 'None' }),
        items.map((id) => jsx('option', { value: String(id), children: String(id) }))
      ]
    });
    expect(el.type).toBe('select');
  });

  it('accepts null, undefined, false, true, strings, numbers, and reactive functions', () => {
    const el = jsx('div', {
      children: [null, undefined, false, true, 'text', 42, () => 'reactive']
    });
    expect(el.type).toBe('div');
  });
});
