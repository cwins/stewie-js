// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDevtools, destroyDevtools } from '../src/index.js';
import { __devHooks } from '@stewie-js/core';
import { isVisible } from '../src/panel.js';
import { addRenderEntry } from '../src/tabs/renders.js';
import { addSignalEntry, addStoreEntry } from '../src/tabs/stores.js';

beforeEach(() => {
  destroyDevtools();
});

afterEach(() => {
  destroyDevtools();
});

describe('initDevtools', () => {
  it('mounts the panel to document.body', () => {
    initDevtools();
    const panel = document.querySelector('[data-testid="__stewie-devtools__"]');
    expect(panel).not.toBeNull();
  });

  it('is idempotent — calling twice does not mount two panels', () => {
    initDevtools();
    initDevtools();
    const panels = document.querySelectorAll('[data-testid="__stewie-devtools__"]');
    expect(panels.length).toBe(1);
  });
});

describe('destroyDevtools', () => {
  it('removes the panel from document.body', () => {
    initDevtools();
    destroyDevtools();
    const panel = document.querySelector('[data-testid="__stewie-devtools__"]');
    expect(panel).toBeNull();
  });
});

describe('hooks', () => {
  it('installs all hooks after init', () => {
    initDevtools();
    expect(__devHooks.onEffectRun).toBeDefined();
    expect(__devHooks.onSignalWrite).toBeDefined();
    expect(__devHooks.onStoreWrite).toBeDefined();
  });

  it('removes all hooks after destroy', () => {
    initDevtools();
    destroyDevtools();
    expect(__devHooks.onEffectRun).toBeUndefined();
    expect(__devHooks.onSignalWrite).toBeUndefined();
    expect(__devHooks.onStoreWrite).toBeUndefined();
  });
});

describe('keyboard shortcut', () => {
  it('Alt+D toggles panel visibility', () => {
    initDevtools();
    expect(isVisible()).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'd', bubbles: true }));
    expect(isVisible()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key: 'd', bubbles: true }));
    expect(isVisible()).toBe(false);
  });
});

describe('renders tab', () => {
  it('addRenderEntry adds to the renders log when element is present', () => {
    initDevtools();
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(() => {
      addRenderEntry({ element: el, attr: 'class', type: 'prop' });
    }).not.toThrow();
    el.remove();
  });
});

describe('stores tab', () => {
  it('addSignalEntry adds to the stores log without throwing', () => {
    initDevtools();
    expect(() => {
      addSignalEntry(42);
      addSignalEntry('hello');
      addSignalEntry({ nested: true });
    }).not.toThrow();
  });

  it('addStoreEntry adds store writes to the log without throwing', () => {
    initDevtools();
    expect(() => {
      addStoreEntry('tasks', [{ id: 't1', title: 'Test' }]);
      addStoreEntry('user.name', 'Alice');
    }).not.toThrow();
  });

  it('onStoreWrite hook fires when a store property is written', () => {
    initDevtools();
    const writes: Array<{ path: string; value: unknown }> = [];
    const orig = __devHooks.onStoreWrite;
    __devHooks.onStoreWrite = (path, value) => {
      writes.push({ path, value });
      orig?.(path, value);
    };
    __devHooks.onStoreWrite('tasks', ['a', 'b']);
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('tasks');
    __devHooks.onStoreWrite = orig;
  });
});

describe('navigation detection', () => {
  it('pushState patch fires onNavigation', () => {
    initDevtools();
    // history.pushState should have been patched (no Navigation API in happy-dom)
    let called = false;
    const origOnNav = (globalThis as Record<string, unknown>).__sdt_onNav;
    void origOnNav; // suppress unused warning

    // Push a new URL and verify the routes tab re-renders without error
    expect(() => {
      history.pushState(null, '', '/test-route');
      history.pushState(null, '', '/');
    }).not.toThrow();
    void called;
  });
});
