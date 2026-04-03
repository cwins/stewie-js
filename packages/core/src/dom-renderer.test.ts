// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { jsx, Fragment } from './jsx-runtime.js';
import { signal, createRoot } from './reactive.js';
import { Show, For, Switch, Match, ErrorBoundary } from './components.js';
import { mount } from './dom-renderer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function container(): HTMLDivElement {
  return document.createElement('div');
}

function sig<T>(v: T) {
  let s!: ReturnType<typeof signal<T>>;
  createRoot(() => {
    s = signal(v);
  });
  return s;
}

// ---------------------------------------------------------------------------
// mount — basic rendering
// ---------------------------------------------------------------------------

describe('mount — static rendering', () => {
  it('renders a string element', () => {
    const c = container();
    mount(jsx('p', { children: 'hello' }), c);
    expect(c.textContent).toBe('hello');
  });

  it('renders nested elements', () => {
    const c = container();
    mount(jsx('div', { children: jsx('span', { children: 'inner' }) }), c);
    expect(c.querySelector('span')?.textContent).toBe('inner');
  });

  it('renders an array of children', () => {
    const c = container();
    mount(
      jsx('ul', {
        children: [jsx('li', { children: 'a' }), jsx('li', { children: 'b' }), jsx('li', { children: 'c' })]
      }),
      c
    );
    expect(c.querySelectorAll('li').length).toBe(3);
    expect(c.querySelectorAll('li')[1].textContent).toBe('b');
  });

  it('renders Fragment', () => {
    const c = container();
    mount(
      jsx(Fragment, {
        children: [jsx('span', { children: 'x' }), jsx('span', { children: 'y' })]
      }),
      c
    );
    expect(c.querySelectorAll('span').length).toBe(2);
  });

  it('renders a number child', () => {
    const c = container();
    mount(jsx('p', { children: 42 }), c);
    expect(c.textContent).toBe('42');
  });

  it('renders null/false children silently', () => {
    const c = container();
    mount(jsx('div', { children: null }), c);
    expect(c.children.length).toBe(1); // the div itself
  });
});

// ---------------------------------------------------------------------------
// mount — attributes
// ---------------------------------------------------------------------------

describe('mount — static attributes', () => {
  it('sets class attribute', () => {
    const c = container();
    mount(jsx('div', { class: 'foo bar' }), c);
    expect(c.firstElementChild?.getAttribute('class')).toBe('foo bar');
  });

  it('sets id attribute', () => {
    const c = container();
    mount(jsx('div', { id: 'my-id' }), c);
    expect(c.firstElementChild?.getAttribute('id')).toBe('my-id');
  });

  it('sets boolean attribute (true → empty string)', () => {
    const c = container();
    mount(jsx('input', { disabled: true }), c);
    expect((c.firstElementChild as HTMLInputElement).disabled).toBe(true);
  });

  it('removes attribute when value is false', () => {
    const c = container();
    mount(jsx('div', { hidden: false }), c);
    expect(c.firstElementChild?.hasAttribute('hidden')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// mount — component functions
// ---------------------------------------------------------------------------

describe('mount — components', () => {
  it('renders a component function', () => {
    function Greeting({ name }: Record<string, unknown>) {
      return jsx('p', { children: `Hello, ${name as string}` });
    }
    const c = container();
    mount(jsx(Greeting, { name: 'World' }), c);
    expect(c.textContent).toBe('Hello, World');
  });

  it('renders nested components', () => {
    function Inner() {
      return jsx('span', { children: 'inner' });
    }
    function Outer() {
      return jsx('div', { children: jsx(Inner, {}) });
    }
    const c = container();
    mount(jsx(Outer, {}), c);
    expect(c.querySelector('span')?.textContent).toBe('inner');
  });

  it('component can create signals with createRoot', () => {
    function Counter() {
      const count = sig(0);
      return jsx('span', { children: count });
    }
    const c = container();
    mount(jsx(Counter, {}), c);
    expect(c.textContent).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// mount — reactive props
// ---------------------------------------------------------------------------

describe('mount — reactive props', () => {
  it('updates class when signal changes', () => {
    const cls = sig('initial');
    const c = container();
    mount(jsx('div', { class: cls }), c);
    expect(c.firstElementChild?.getAttribute('class')).toBe('initial');
    cls.set('updated');
    expect(c.firstElementChild?.getAttribute('class')).toBe('updated');
  });

  it('updates text content when signal changes', () => {
    const text = sig('hello');
    const c = container();
    mount(jsx('p', { children: text }), c);
    expect(c.textContent).toBe('hello');
    text.set('world');
    expect(c.textContent).toBe('world');
  });

  it('updates nested reactive child', () => {
    const count = sig(0);
    const c = container();
    mount(jsx('div', { children: jsx('span', { children: count }) }), c);
    expect(c.querySelector('span')?.textContent).toBe('0');
    count.set(5);
    expect(c.querySelector('span')?.textContent).toBe('5');
  });
});

// ---------------------------------------------------------------------------
// mount — event handlers
// ---------------------------------------------------------------------------

describe('mount — event handlers', () => {
  it('attaches click handler', () => {
    const clicks: number[] = [];
    const c = container();
    mount(jsx('button', { onClick: () => clicks.push(1), children: 'btn' }), c);
    const btn = c.querySelector('button')!;
    btn.click();
    btn.click();
    expect(clicks).toEqual([1, 1]);
  });

  it('removes event listener on dispose', () => {
    const clicks: number[] = [];
    const c = container();
    const dispose = mount(jsx('button', { onClick: () => clicks.push(1), children: 'btn' }), c);
    const btn = c.querySelector('button')!;
    btn.click();
    dispose();
    btn.click(); // button removed, no handler
    expect(clicks).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------
// mount — ref
// ---------------------------------------------------------------------------

describe('mount — ref', () => {
  it('calls ref callback with the element', () => {
    let captured: Element | null = null;
    const c = container();
    mount(
      jsx('div', {
        ref: (el: Element) => {
          captured = el;
        }
      }),
      c
    );
    expect(captured).toBe(c.firstElementChild);
  });
});

// ---------------------------------------------------------------------------
// Show
// ---------------------------------------------------------------------------

describe('Show', () => {
  it('renders children when when is truthy', () => {
    const c = container();
    mount(Show({ when: true, children: jsx('p', { children: 'visible' }) }), c);
    expect(c.textContent).toBe('visible');
  });

  it('renders fallback when when is falsy', () => {
    const c = container();
    mount(
      Show({
        when: false,
        children: jsx('p', { children: 'content' }),
        fallback: jsx('p', { children: 'fallback' })
      }),
      c
    );
    expect(c.textContent).toBe('fallback');
  });

  it('renders nothing when when is falsy and no fallback', () => {
    const c = container();
    mount(Show({ when: false, children: jsx('p', { children: 'x' }) }), c);
    expect(c.textContent).toBe('');
  });

  it('reacts to signal — false → true', () => {
    const visible = sig(false);
    const c = container();
    mount(
      Show({
        when: visible,
        children: jsx('p', { children: 'shown' }),
        fallback: jsx('p', { children: 'hidden' })
      }),
      c
    );
    expect(c.textContent).toBe('hidden');
    visible.set(true);
    expect(c.textContent).toBe('shown');
    visible.set(false);
    expect(c.textContent).toBe('hidden');
  });

  it('does not re-render when value stays the same', () => {
    const visible = sig(true);
    let renders = 0;
    const c = container();
    mount(
      Show({
        when: visible,
        children: jsx('p', {
          children: (() => {
            renders++;
            return 'x';
          })()
        })
      }),
      c
    );
    expect(renders).toBe(1);
    visible.set(true); // same value
    expect(renders).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// For
// ---------------------------------------------------------------------------

describe('For', () => {
  it('renders a static list', () => {
    const c = container();
    mount(
      For({
        each: ['a', 'b', 'c'],
        children: (item) => jsx('li', { children: (item as () => string)() })
      }),
      c
    );
    const items = c.querySelectorAll('li');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('a');
    expect(items[2].textContent).toBe('c');
  });

  it('reacts to signal — adds item', () => {
    const items = sig(['x', 'y']);
    const c = container();
    mount(
      For({
        each: items,
        children: (item) => jsx('li', { children: (item as () => string)() })
      }),
      c
    );
    expect(c.querySelectorAll('li').length).toBe(2);
    items.set(['x', 'y', 'z']);
    expect(c.querySelectorAll('li').length).toBe(3);
    expect(c.querySelectorAll('li')[2].textContent).toBe('z');
  });

  it('reacts to signal — removes item', () => {
    const items = sig([1, 2, 3]);
    const c = container();
    mount(
      For({
        each: items,
        children: (item) => jsx('li', { children: String((item as () => number)()) })
      }),
      c
    );
    items.set([1, 3]);
    expect(c.querySelectorAll('li').length).toBe(2);
  });

  it('renders empty when each is empty', () => {
    const c = container();
    mount(
      For({
        each: [],
        children: () => jsx('li', { children: 'x' })
      }),
      c
    );
    expect(c.querySelectorAll('li').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// For — keyed mode
// ---------------------------------------------------------------------------

describe('For (keyed)', () => {
  it('preserves DOM node identity for stable keys when list changes', () => {
    const items = sig([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' }
    ]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => jsx('li', { children: (item as () => { id: number; text: string })().text })
      }),
      c
    );

    const firstLi = c.querySelector('li')!;
    expect(firstLi.textContent).toBe('a');

    // Add an item at the end — existing nodes should not be recreated
    items.set([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' },
      { id: 4, text: 'd' }
    ]);
    expect(c.querySelector('li')).toBe(firstLi); // same DOM node
    expect(c.querySelectorAll('li').length).toBe(4);
    expect(c.querySelectorAll('li')[3].textContent).toBe('d');
  });

  it('removes only items whose keys disappear', () => {
    const items = sig([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => jsx('li', { children: String((item as () => { id: number })().id) })
      }),
      c
    );

    items.set([{ id: 1 }, { id: 3 }]);
    expect(c.querySelectorAll('li').length).toBe(2);
    expect(c.querySelectorAll('li')[0].textContent).toBe('1');
    expect(c.querySelectorAll('li')[1].textContent).toBe('3');
  });

  it('reorders items by key without rebuilding stable nodes', () => {
    const items = sig([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' }
    ]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => jsx('li', { children: (item as () => { id: number; text: string })().text })
      }),
      c
    );

    const [liA, liB, liC] = Array.from(c.querySelectorAll('li'));

    // Reverse the order
    items.set([
      { id: 3, text: 'c' },
      { id: 2, text: 'b' },
      { id: 1, text: 'a' }
    ]);

    const reordered = Array.from(c.querySelectorAll('li'));
    expect(reordered[0].textContent).toBe('c');
    expect(reordered[1].textContent).toBe('b');
    expect(reordered[2].textContent).toBe('a');
    // Same DOM node instances — just moved
    expect(reordered[0]).toBe(liC);
    expect(reordered[1]).toBe(liB);
    expect(reordered[2]).toBe(liA);
  });

  it('handles inserting new item in the middle', () => {
    const items = sig([
      { id: 1, text: 'a' },
      { id: 3, text: 'c' }
    ]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => jsx('li', { children: (item as () => { id: number; text: string })().text })
      }),
      c
    );

    items.set([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' }
    ]);
    const lis = c.querySelectorAll('li');
    expect(lis.length).toBe(3);
    expect(lis[0].textContent).toBe('a');
    expect(lis[1].textContent).toBe('b');
    expect(lis[2].textContent).toBe('c');
  });

  it('swap two items uses minimal DOM moves (LIS correctness)', () => {
    // 5 items — swap index 1 and 3 (ids 2 and 4)
    const mk = (id: number, text: string) => ({ id, text });
    const items = sig([mk(1, 'a'), mk(2, 'b'), mk(3, 'c'), mk(4, 'd'), mk(5, 'e')]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => jsx('li', { children: (item as () => { id: number; text: string })().text })
      }),
      c
    );
    const [li1, , li3, , li5] = Array.from(c.querySelectorAll('li'));

    // Swap ids 2 and 4
    items.set([mk(1, 'a'), mk(4, 'd'), mk(3, 'c'), mk(2, 'b'), mk(5, 'e')]);
    const after = Array.from(c.querySelectorAll('li'));
    expect(after.map((l) => l.textContent)).toEqual(['a', 'd', 'c', 'b', 'e']);
    // Stable items (1, 3, 5) must be the exact same DOM nodes
    expect(after[0]).toBe(li1);
    expect(after[2]).toBe(li3);
    expect(after[4]).toBe(li5);
  });

  it('remove one item from large list leaves others undisturbed', () => {
    const mk = (id: number) => ({ id });
    const items = sig(Array.from({ length: 10 }, (_, i) => mk(i + 1)));
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => jsx('li', { children: String((item as () => { id: number })().id) })
      }),
      c
    );
    const allBefore = Array.from(c.querySelectorAll('li'));
    // Remove id=5 (index 4)
    items.set(items().filter((r) => (r as { id: number }).id !== 5));
    const allAfter = Array.from(c.querySelectorAll('li'));
    expect(allAfter.length).toBe(9);
    expect(allAfter.map((l) => l.textContent)).toEqual(['1', '2', '3', '4', '6', '7', '8', '9', '10']);
    // All remaining nodes are the same DOM elements
    expect(allAfter[0]).toBe(allBefore[0]);
    expect(allAfter[3]).toBe(allBefore[3]);
    expect(allAfter[4]).toBe(allBefore[5]); // was index 5 (id=6), now index 4
  });

  it('updates text when same-key item object is replaced', () => {
    const items = sig([{ id: 1, text: 'a', done: false }]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => {
          const i = item as () => { id: number; text: string; done: boolean };
          return jsx('li', { children: () => i().text });
        }
      }),
      c
    );
    expect(c.querySelector('li')?.textContent).toBe('a');
    const liNode = c.querySelector('li')!;
    items.set([{ id: 1, text: 'b', done: true }]);
    expect(c.querySelector('li')?.textContent).toBe('b');
    // Same DOM node preserved
    expect(c.querySelector('li')).toBe(liNode);
  });

  it('updates class when same-key item done field changes', () => {
    const items = sig([{ id: 1, text: 'x', done: false }]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => {
          const i = item as () => { id: number; text: string; done: boolean };
          return jsx('li', { class: () => (i().done ? 'done' : ''), children: () => i().text });
        }
      }),
      c
    );
    expect(c.querySelector('li')?.getAttribute('class')).toBe('');
    items.set([{ id: 1, text: 'x', done: true }]);
    expect(c.querySelector('li')?.getAttribute('class')).toBe('done');
  });

  it('mixed update preserves unaffected nodes and updates affected row', () => {
    const items = sig([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' },
      { id: 3, text: 'c' }
    ]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => {
          const i = item as () => { id: number; text: string };
          return jsx('li', { children: () => i().text });
        }
      }),
      c
    );
    const [li1, li2, li3] = Array.from(c.querySelectorAll('li'));
    items.set([
      { id: 1, text: 'a' },
      { id: 2, text: 'B updated' },
      { id: 3, text: 'c' }
    ]);
    const after = Array.from(c.querySelectorAll('li'));
    expect(after[0].textContent).toBe('a');
    expect(after[1].textContent).toBe('B updated');
    expect(after[2].textContent).toBe('c');
    // All three are the same DOM nodes
    expect(after[0]).toBe(li1);
    expect(after[1]).toBe(li2);
    expect(after[2]).toBe(li3);
  });

  it('disposed keyed entry stops updating after key is removed', () => {
    const items = sig([
      { id: 1, text: 'a' },
      { id: 2, text: 'b' }
    ]);
    const c = container();
    mount(
      For({
        each: items,
        by: (item) => (item as { id: number }).id,
        children: (item) => {
          const i = item as () => { id: number; text: string };
          return jsx('li', { children: () => i().text });
        }
      }),
      c
    );
    expect(c.querySelectorAll('li').length).toBe(2);
    // Remove id=1
    items.set([{ id: 2, text: 'b' }]);
    expect(c.querySelectorAll('li').length).toBe(1);
    expect(c.querySelector('li')?.textContent).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// Switch / Match
// ---------------------------------------------------------------------------

describe('Switch / Match', () => {
  it('renders first matching branch', () => {
    const c = container();
    mount(
      Switch({
        children: [
          Match({ when: false, children: jsx('p', { children: 'no' }) }),
          Match({ when: true, children: jsx('p', { children: 'yes' }) })
        ]
      }),
      c
    );
    expect(c.textContent).toBe('yes');
  });

  it('renders fallback when no branch matches', () => {
    const c = container();
    mount(
      Switch({
        fallback: jsx('p', { children: 'none' }),
        children: [Match({ when: false, children: jsx('p', { children: 'no' }) })]
      }),
      c
    );
    expect(c.textContent).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const c = container();
    mount(
      ErrorBoundary({
        fallback: () => jsx('p', { children: 'error' }),
        children: jsx('p', { children: 'ok' })
      }),
      c
    );
    expect(c.textContent).toBe('ok');
  });

  it('renders fallback when children throw', () => {
    const Thrower = () => {
      throw new Error('boom');
    };
    const c = container();
    // suppress console.error from vitest
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(
      ErrorBoundary({
        fallback: (err: unknown) => jsx('p', { children: `caught: ${(err as Error).message}` }),
        children: jsx(Thrower as unknown as () => ReturnType<typeof jsx>, {})
      }),
      c
    );
    expect(c.textContent).toBe('caught: boom');
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

describe('dispose', () => {
  it('removes DOM nodes on dispose', () => {
    const c = container();
    const dispose = mount(jsx('p', { children: 'test' }), c);
    expect(c.children.length).toBe(1);
    dispose();
    expect(c.children.length).toBe(0);
  });

  it('stops reactive updates after dispose', () => {
    const text = sig('before');
    const c = container();
    const dispose = mount(jsx('p', { children: text }), c);
    expect(c.textContent).toBe('before');
    dispose();
    text.set('after');
    expect(c.textContent).toBe(''); // container empty
  });

  it('dispose is idempotent', () => {
    const c = container();
    const dispose = mount(jsx('p', { children: 'x' }), c);
    expect(() => {
      dispose();
      dispose();
    }).not.toThrow();
  });

  it('Show cleans up effect on dispose', () => {
    const visible = sig(true);
    const c = container();
    const dispose = mount(Show({ when: visible, children: jsx('p', { children: 'x' }) }), c);
    dispose();
    visible.set(false);
    // Should not throw and container stays empty
    expect(c.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// mount — function root (DOM runtime mode entry point)
// ---------------------------------------------------------------------------

describe('mount — function root', () => {
  it('accepts a function returning a JSXElement', () => {
    const c = container();
    mount(() => jsx('p', { children: 'fn root' }), c);
    expect(c.textContent).toBe('fn root');
  });

  it('clears container before mounting', () => {
    const c = container();
    c.innerHTML = '<span>stale</span>';
    mount(jsx('p', { children: 'fresh' }), c);
    expect(c.querySelectorAll('span').length).toBe(0);
    expect(c.textContent).toBe('fresh');
  });
});
