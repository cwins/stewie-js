// reactive.ts — signal, computed, effect, batch, scope internals

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Signal<T> {
  (): T
  set(value: T): void
  update(fn: (current: T) => T): void
}

export interface Computed<T> {
  (): T
}

export type Dispose = () => void

export interface Scope {
  dependencies: Set<Subscribable>
}

// ---------------------------------------------------------------------------
// Subscribable interface — anything effects/computed can subscribe to
// ---------------------------------------------------------------------------

export interface Subscribable {
  _subscribe(sub: Subscriber): void
  _unsubscribe(sub: Subscriber): void
}

export interface Subscriber {
  _invalidate(): void
}

// ---------------------------------------------------------------------------
// Dev mode detection
// ---------------------------------------------------------------------------

export const isDev = typeof process !== 'undefined'
  ? process?.env?.NODE_ENV !== 'production'
  : true

// ---------------------------------------------------------------------------
// Module-scope creation guard (dev-mode warning)
// ---------------------------------------------------------------------------

export let _allowReactiveCreation = false

export function _setAllowReactiveCreation(v: boolean): void {
  _allowReactiveCreation = v
}

export function _warnModuleScope(): void {
  if (isDev && !_allowReactiveCreation && _scopeStack.length === 0) {
    console.warn(
      '[stewie] signal()/store() called at module scope. Reactive primitives must be created inside components or lifecycle hooks.'
    )
  }
}

// ---------------------------------------------------------------------------
// Tracking scope stack (module-level — this is framework infrastructure)
// ---------------------------------------------------------------------------

export const _scopeStack: Scope[] = []

export function getCurrentScope(): Scope | null {
  return _scopeStack.length > 0 ? _scopeStack[_scopeStack.length - 1] : null
}

export function createScope(fn: () => void): { dependencies: Set<Subscribable> } {
  const scope: Scope = { dependencies: new Set() }
  _scopeStack.push(scope)
  try {
    fn()
  } finally {
    _scopeStack.pop()
  }
  return scope
}

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

let _batchDepth = 0
const _pendingEffects = new Set<EffectNode>()

export function batch(fn: () => void): void {
  _batchDepth++
  try {
    fn()
  } finally {
    _batchDepth--
    if (_batchDepth === 0) {
      _flushBatch()
    }
  }
}

function _flushBatch(): void {
  const effects = new Set(_pendingEffects)
  _pendingEffects.clear()
  for (const e of effects) {
    e._run()
  }
}

export function _isBatching(): boolean {
  return _batchDepth > 0
}

export function _scheduleEffect(e: EffectNode): void {
  if (_batchDepth > 0) {
    _pendingEffects.add(e)
  } else {
    e._run()
  }
}

// ---------------------------------------------------------------------------
// ReactiveNode base
// ---------------------------------------------------------------------------

export class ReactiveNode<T> implements Subscribable {
  protected _value!: T
  protected _subscribers = new Set<Subscriber>()

  _subscribe(sub: Subscriber): void {
    this._subscribers.add(sub)
  }

  _unsubscribe(sub: Subscriber): void {
    this._subscribers.delete(sub)
  }

  protected _trackInScope(): void {
    const scope = getCurrentScope()
    if (scope) {
      scope.dependencies.add(this)
    }
  }

  protected _notifySubscribers(): void {
    const subs = new Set(this._subscribers)
    for (const sub of subs) {
      sub._invalidate()
    }
  }
}

// ---------------------------------------------------------------------------
// SignalNode
// ---------------------------------------------------------------------------

class SignalNode<T> extends ReactiveNode<T> {
  constructor(initial: T) {
    super()
    this._value = initial
  }

  read(): T {
    this._trackInScope()
    return this._value
  }

  write(value: T): void {
    if (value === this._value) return
    this._value = value
    this._notifySubscribers()
  }
}

// ---------------------------------------------------------------------------
// ComputedNode — push-pull hybrid
//
// When a dependency changes:
//   1. computed is invalidated (_invalidate called)
//   2. computed eagerly recomputes
//   3. if value changed → notifies own subscribers (effects/other computeds)
//   4. if value unchanged → stops propagation (memoization)
//
// This ensures effects only re-run when computed values actually change.
// ---------------------------------------------------------------------------

export class ComputedNode<T> extends ReactiveNode<T> implements Subscriber {
  private _fn: () => T
  private _dirty = true
  private _deps = new Set<Subscribable>()
  private _computing = false
  private _initialized = false

  constructor(fn: () => T) {
    super()
    this._fn = fn
  }

  read(): T {
    if (this._dirty) {
      this._recompute()
    }
    this._trackInScope()
    return this._value
  }

  private _recompute(): void {
    if (this._computing) {
      throw new Error('[stewie] Circular computed dependency detected')
    }
    this._computing = true

    // Unsubscribe from old deps
    for (const dep of this._deps) {
      dep._unsubscribe(this)
    }
    this._deps.clear()

    const scope: Scope = { dependencies: new Set() }
    _scopeStack.push(scope)
    let newValue: T
    try {
      newValue = this._fn()
    } finally {
      _scopeStack.pop()
      this._computing = false
    }

    // Subscribe to new deps
    for (const dep of scope.dependencies) {
      dep._subscribe(this)
      this._deps.add(dep)
    }

    const wasInitialized = this._initialized
    const changed = !wasInitialized || newValue !== this._value
    this._value = newValue
    this._dirty = false
    this._initialized = true

    // Only notify downstream if value actually changed (memoization)
    if (wasInitialized && changed) {
      this._notifySubscribers()
    }
  }

  _invalidate(): void {
    // Eagerly recompute — this allows us to stop propagation if value is unchanged
    // Mark dirty first so _recompute will run
    if (!this._dirty) {
      this._dirty = true
      // Recompute eagerly to check if value changed before propagating
      // This is the key to memoization: don't notify effects if value is same
      this._recompute()
    }
  }
}

// ---------------------------------------------------------------------------
// EffectNode
// ---------------------------------------------------------------------------

export class EffectNode implements Subscriber {
  private _fn: () => void | (() => void)
  private _cleanup: (() => void) | void = undefined
  private _deps = new Set<Subscribable>()
  private _disposed = false
  private _running = false

  constructor(fn: () => void | (() => void)) {
    this._fn = fn
    this._run()
  }

  _run(): void {
    if (this._disposed) return
    if (this._running) return

    // Run cleanup from previous run
    if (typeof this._cleanup === 'function') {
      this._cleanup()
      this._cleanup = undefined
    }

    // Unsubscribe from old deps
    for (const dep of this._deps) {
      dep._unsubscribe(this)
    }
    this._deps.clear()

    this._running = true
    const scope: Scope = { dependencies: new Set() }
    _scopeStack.push(scope)
    let cleanup: void | (() => void)
    try {
      cleanup = this._fn() as void | (() => void)
    } finally {
      _scopeStack.pop()
      this._running = false
    }

    this._cleanup = cleanup

    // Subscribe to new deps
    for (const dep of scope.dependencies) {
      dep._subscribe(this)
      this._deps.add(dep)
    }
  }

  _invalidate(): void {
    if (this._disposed || this._running) return
    if (_isBatching()) {
      _scheduleEffect(this)
    } else {
      this._run()
    }
  }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true

    if (typeof this._cleanup === 'function') {
      this._cleanup()
      this._cleanup = undefined
    }

    for (const dep of this._deps) {
      dep._unsubscribe(this)
    }
    this._deps.clear()
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function signal<T>(initialValue: T): Signal<T> {
  _warnModuleScope()

  const node = new SignalNode(initialValue)

  const sig = function (): T {
    return node.read()
  } as Signal<T>

  sig.set = function (value: T): void {
    node.write(value)
  }

  sig.update = function (fn: (current: T) => T): void {
    // Use untrack to avoid subscribing the current scope to this signal
    node.write(untrack(() => fn(node.read())))
  }

  return sig
}

export function computed<T>(fn: () => T): Computed<T> {
  const node = new ComputedNode(fn)

  return function (): T {
    return node.read()
  }
}

export function effect(fn: () => void | (() => void)): Dispose {
  const node = new EffectNode(fn)
  return () => node.dispose()
}

// Run fn without registering any reactive subscriptions in the current scope.
export function untrack<T>(fn: () => T): T {
  const saved = _scopeStack.splice(0)
  try {
    return fn()
  } finally {
    _scopeStack.push(...saved)
  }
}

// Create a reactive root scope — clean alternative to _setAllowReactiveCreation.
// All signal()/store()/computed()/effect() calls inside fn are allowed.
export function createRoot<T>(fn: () => T): T {
  const prev = _allowReactiveCreation
  _allowReactiveCreation = true
  try {
    return fn()
  } finally {
    _allowReactiveCreation = prev
  }
}
