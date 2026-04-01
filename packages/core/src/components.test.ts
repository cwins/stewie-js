import { describe, it, expect } from 'vitest';
import { Show, For, Switch, Match, Portal, ErrorBoundary, Suspense, ClientOnly } from './components.js';
import { jsx } from './jsx-runtime.js';

const dummyEl = jsx('div', {});
const dummyFallback = jsx('span', { class: 'fallback' });

describe('Show', () => {
  it('creates element descriptor with correct type and props', () => {
    const props = { when: true, children: dummyEl, fallback: dummyFallback };
    const el = Show(props);
    expect(el.type).toBe(Show);
    expect(el.props).toMatchObject({ when: true, children: dummyEl, fallback: dummyFallback });
    expect(el.key).toBeNull();
  });

  it('works with a reactive when condition', () => {
    const when = () => false;
    const el = Show({ when, children: dummyEl });
    expect(el.type).toBe(Show);
    expect(el.props.when).toBe(when);
  });
});

describe('For', () => {
  it('creates element descriptor with correct type and props', () => {
    const items = [1, 2, 3];
    const renderItem = (item: () => number) => jsx('li', { children: String(item()) });
    const el = For({ each: items, children: renderItem });
    expect(el.type).toBe(For);
    expect(el.props.each).toBe(items);
    expect(el.props.children).toBe(renderItem);
  });
});

describe('Switch', () => {
  it('creates element descriptor with correct type and props', () => {
    const el = Switch({ children: dummyEl, fallback: dummyFallback });
    expect(el.type).toBe(Switch);
    expect(el.props.fallback).toBe(dummyFallback);
  });
});

describe('Match', () => {
  it('creates element descriptor with correct type and props', () => {
    const el = Match({ when: true, children: dummyEl });
    expect(el.type).toBe(Match);
    expect(el.props.when).toBe(true);
    expect(el.props.children).toBe(dummyEl);
  });
});

describe('Portal', () => {
  it('creates element descriptor with correct type and props', () => {
    const el = Portal({ target: '#modal', children: dummyEl });
    expect(el.type).toBe(Portal);
    expect(el.props.target).toBe('#modal');
  });
});

describe('ErrorBoundary', () => {
  it('creates element descriptor with correct type and props', () => {
    const fallback = (err: unknown) => jsx('div', { children: String(err) });
    const el = ErrorBoundary({ fallback, children: dummyEl });
    expect(el.type).toBe(ErrorBoundary);
    expect(el.props.fallback).toBe(fallback);
    expect(el.props.children).toBe(dummyEl);
  });
});

describe('Suspense', () => {
  it('creates element descriptor with correct type and props', () => {
    const el = Suspense({ fallback: dummyFallback, children: dummyEl });
    expect(el.type).toBe(Suspense);
    expect(el.props.fallback).toBe(dummyFallback);
    expect(el.props.children).toBe(dummyEl);
  });
});

describe('ClientOnly', () => {
  it('creates element descriptor with correct type and props', () => {
    const el = ClientOnly({ children: dummyEl });
    expect(el.type).toBe(ClientOnly);
    expect(el.props.children).toBe(dummyEl);
  });
});
