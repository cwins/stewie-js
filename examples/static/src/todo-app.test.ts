// @vitest-environment happy-dom
//
// Integration tests for the client-side todo app.
// Tests mount a real DOM tree and drive it through user interactions
// (input events, button clicks), asserting reactive DOM updates.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mountTodoApp } from './todo-app.js'
import type { Disposer } from '@stewie-js/core'

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement
let dispose: Disposer

beforeEach(() => {
  container = document.createElement('div')
  dispose = mountTodoApp(container)
})

afterEach(() => {
  dispose()
})

// Minimal query helpers
function q(sel: string): Element | null {
  return container.querySelector(sel)
}
function qAll(sel: string): Element[] {
  return Array.from(container.querySelectorAll(sel))
}
function click(sel: string): void {
  q(sel)!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

/** Type into the input and dispatch an `input` event so the signal updates. */
function typeInto(sel: string, text: string): void {
  const el = q(sel) as HTMLInputElement
  el.value = text
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Helper: type text + click Add in one step. */
function addTodo(text: string): void {
  typeInto('[data-testid="todo-input"]', text)
  click('[data-testid="add-btn"]')
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial render', () => {
  it('renders the app container', () => {
    expect(q('[data-testid="todo-app"]')).not.toBeNull()
  })

  it('shows the empty message', () => {
    const msg = q('[data-testid="empty-msg"]')
    expect(msg).not.toBeNull()
    expect(msg!.textContent).toBe('No todos yet. Add one above!')
  })

  it('does not render the main section yet', () => {
    expect(q('[data-testid="main-section"]')).toBeNull()
  })

  it('has an empty input', () => {
    expect((q('[data-testid="todo-input"]') as HTMLInputElement).value).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Adding todos
// ---------------------------------------------------------------------------

describe('adding todos', () => {
  it('mounts the main section after the first add', () => {
    addTodo('Learn Stewie')
    expect(q('[data-testid="main-section"]')).not.toBeNull()
  })

  it('hides the empty message after adding', () => {
    addTodo('First task')
    expect(q('[data-testid="empty-msg"]')).toBeNull()
  })

  it('renders the todo text', () => {
    addTodo('Walk the dog')
    expect(q('[data-testid="text-1"]')!.textContent).toBe('Walk the dog')
  })

  it('clears the input after adding', () => {
    addTodo('Something')
    expect((q('[data-testid="todo-input"]') as HTMLInputElement).value).toBe('')
  })

  it('ignores clicks when the input is empty', () => {
    click('[data-testid="add-btn"]')
    expect(q('[data-testid="main-section"]')).toBeNull()
  })

  it('adds multiple todos in order', () => {
    addTodo('First')
    addTodo('Second')
    addTodo('Third')
    const texts = qAll('[data-testid^="text-"]').map((el) => el.textContent)
    expect(texts).toEqual(['First', 'Second', 'Third'])
  })
})

// ---------------------------------------------------------------------------
// Status message — Switch / Match
// ---------------------------------------------------------------------------

describe('status message (Switch/Match)', () => {
  it('shows remaining count after adding todos', () => {
    addTodo('Task one')
    addTodo('Task two')
    expect(q('[data-testid="status-msg"]')!.textContent).toBe('2 of 2 left')
  })

  it('updates count when a todo is added mid-session', () => {
    addTodo('A')
    expect(q('[data-testid="status-msg"]')!.textContent).toBe('1 of 1 left')
    addTodo('B')
    expect(q('[data-testid="status-msg"]')!.textContent).toBe('2 of 2 left')
  })

  it('shows "All done!" when every todo is completed', () => {
    addTodo('Only task')
    click('[data-testid="toggle-1"]')
    const msg = q('[data-testid="status-msg"]')
    expect(msg!.textContent).toBe('All done!')
    expect(msg!.classList.contains('all-done')).toBe(true)
  })

  it('reverts from "All done!" when a todo is un-toggled', () => {
    addTodo('Task')
    click('[data-testid="toggle-1"]') // mark done
    click('[data-testid="toggle-1"]') // undo
    expect(q('[data-testid="status-msg"]')!.textContent).toBe('1 of 1 left')
  })
})

// ---------------------------------------------------------------------------
// Toggling todos — For re-renders items with updated class
// ---------------------------------------------------------------------------

describe('toggling todos', () => {
  it('item starts with class "pending"', () => {
    addTodo('Pending item')
    expect(q('[data-testid="item-1"]')!.classList.contains('pending')).toBe(true)
  })

  it('item gets class "done" after toggle', () => {
    addTodo('Do this')
    click('[data-testid="toggle-1"]')
    // For re-renders the item with the updated Todo object
    expect(q('[data-testid="item-1"]')!.classList.contains('done')).toBe(true)
  })

  it('toggle button label switches between "Done" and "Undo"', () => {
    addTodo('Flip me')
    expect(q('[data-testid="toggle-1"]')!.textContent).toBe('Done')
    click('[data-testid="toggle-1"]')
    expect(q('[data-testid="toggle-1"]')!.textContent).toBe('Undo')
    click('[data-testid="toggle-1"]')
    expect(q('[data-testid="toggle-1"]')!.textContent).toBe('Done')
  })

  it('decrements remaining count after toggle', () => {
    addTodo('One')
    addTodo('Two')
    click('[data-testid="toggle-1"]')
    expect(q('[data-testid="status-msg"]')!.textContent).toBe('1 of 2 left')
  })

  it('toggling one item does not affect others', () => {
    addTodo('Alpha')
    addTodo('Beta')
    click('[data-testid="toggle-1"]')
    expect(q('[data-testid="item-2"]')!.classList.contains('pending')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Removing todos
// ---------------------------------------------------------------------------

describe('removing todos', () => {
  it('removes the todo from the list', () => {
    addTodo('Gone soon')
    click('[data-testid="remove-1"]')
    expect(q('[data-testid="item-1"]')).toBeNull()
  })

  it('shows the empty message when the last todo is removed', () => {
    addTodo('Last one')
    click('[data-testid="remove-1"]')
    expect(q('[data-testid="empty-msg"]')).not.toBeNull()
    expect(q('[data-testid="main-section"]')).toBeNull()
  })

  it('leaves the remaining todos intact', () => {
    addTodo('Keep me')
    addTodo('Delete me')
    click('[data-testid="remove-2"]')
    expect(q('[data-testid="item-1"]')).not.toBeNull()
    expect(q('[data-testid="item-2"]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Filtering — For + computed(filtered) collaboration
// ---------------------------------------------------------------------------

describe('filtering', () => {
  // Each test gets a fresh mount (outer beforeEach) then two todos added here,
  // with the second one marked done.
  beforeEach(() => {
    addTodo('Active task') // id=1, done=false
    addTodo('Done task') // id=2, done=false → toggled to done below
    click('[data-testid="toggle-2"]')
  })

  it('shows all todos by default (filter=all)', () => {
    expect(qAll('[data-testid^="item-"]').length).toBe(2)
  })

  it('shows only active todos with filter=active', () => {
    click('[data-testid="filter-active"]')
    const items = qAll('[data-testid^="item-"]')
    expect(items.length).toBe(1)
    expect(items[0].textContent).toContain('Active task')
  })

  it('shows only done todos with filter=done', () => {
    click('[data-testid="filter-done"]')
    const items = qAll('[data-testid^="item-"]')
    expect(items.length).toBe(1)
    expect(items[0].textContent).toContain('Done task')
  })

  it('returns to all todos when switching back to filter=all', () => {
    click('[data-testid="filter-active"]')
    click('[data-testid="filter-all"]')
    expect(qAll('[data-testid^="item-"]').length).toBe(2)
  })

  it('empty list when filter has no matches', () => {
    // Clear all active todos, then filter for active
    click('[data-testid="toggle-1"]') // mark id=1 done too
    click('[data-testid="filter-active"]')
    expect(qAll('[data-testid^="item-"]').length).toBe(0)
  })

  // Reactive class on filter buttons (fine-grained update — no list re-render)
  it('"all" button has active-filter class initially', () => {
    expect(q('[data-testid="filter-all"]')!.getAttribute('class')).toBe('active-filter')
    expect(q('[data-testid="filter-active"]')!.getAttribute('class')).toBe('')
    expect(q('[data-testid="filter-done"]')!.getAttribute('class')).toBe('')
  })

  it('active-filter class moves to the clicked button', () => {
    click('[data-testid="filter-done"]')
    expect(q('[data-testid="filter-all"]')!.getAttribute('class')).toBe('')
    expect(q('[data-testid="filter-done"]')!.getAttribute('class')).toBe('active-filter')
  })
})

// ---------------------------------------------------------------------------
// Dispose
// ---------------------------------------------------------------------------

describe('dispose', () => {
  it('clears the container', () => {
    addTodo('Will be removed')
    dispose()
    expect(container.innerHTML).toBe('')
    // Prevent afterEach from calling dispose() a second time
    dispose = () => {}
  })
})
