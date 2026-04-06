// reactive.ts — signal, computed, effect, batch, scope internals

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Signal<T> {
  (): T;
  /** Read the current value without registering a reactive subscription. */
  peek(): T;
  set(value: T): void;
  update(fn: (current: T) => T): void;
}

export interface Computed<T> {
  (): T;
}

export type Dispose = () => void;

export interface Scope {
  dependencies: Set<Subscribable>;
}

// ---------------------------------------------------------------------------
// Subscribable interface — anything effects/computed can subscribe to
// ---------------------------------------------------------------------------

export interface Subscribable {
  _subscribe(sub: Subscriber): void;
  _unsubscribe(sub: Subscriber): void;
}

export interface Subscriber {
  _invalidate(): void;
}

// ---------------------------------------------------------------------------
// Dev mode detection
// ---------------------------------------------------------------------------

export const isDev = typeof process !== 'undefined' ? process?.env?.NODE_ENV !== 'production' : true;

// ---------------------------------------------------------------------------
// Dev hooks — populated by @stewie-js/devtools, no-op in production
// ---------------------------------------------------------------------------

export interface DevEffectMeta {
  element?: Element;
  attr?: string;
  type: 'prop' | 'children' | 'show' | 'for' | 'switch';
}

export const __devHooks: {
  onEffectRun?: (meta: DevEffectMeta | undefined) => void;
  onSignalWrite?: (value: unknown) => void;
  onStoreWrite?: (path: string, value: unknown) => void;
} = {};

let _pendingEffectMeta: DevEffectMeta | undefined;

export function _setNextEffectMeta(meta: DevEffectMeta): void {
  _pendingEffectMeta = meta;
}

// ---------------------------------------------------------------------------
// Module-scope creation guard (dev-mode warning)
// ---------------------------------------------------------------------------

export let _allowReactiveCreation = false;

export function _setAllowReactiveCreation(v: boolean): void {
  _allowReactiveCreation = v;
}

export function _warnModuleScope(): void {
  if (isDev && !_allowReactiveCreation && _scopeStack.length === 0) {
    console.warn(
      '[stewie] signal()/store() called at module scope. Reactive primitives must be created inside components or lifecycle hooks.'
    );
  }
}

// ---------------------------------------------------------------------------
// Ownership stack — tracks which reactive nodes belong to a createRoot() call
// ---------------------------------------------------------------------------

interface Disposable {
  dispose(): void;
}

// Each entry is the list of owned nodes for one createRoot() invocation.
// Effects and computed nodes register themselves here on creation so the root
// can dispose them all when it tears down (e.g. on component / For-item unmount).
const _ownerStack: Disposable[][] = [];

/**
 * Opaque handle to a reactive ownership scope — the object returned by
 * `getOwner()`. Pass it to `runInOwner()` to register reactive nodes
 * (effects, computed values, cleanup functions) with that scope from
 * outside its original synchronous body, e.g. inside an async callback.
 */
export interface Owner {
  /** @internal */
  _nodes: Disposable[];
}

// ---------------------------------------------------------------------------
// Tracking scope stack (module-level — this is framework infrastructure)
// ---------------------------------------------------------------------------

export const _scopeStack: Scope[] = [];

export function getCurrentScope(): Scope | null {
  return _scopeStack.length > 0 ? _scopeStack[_scopeStack.length - 1] : null;
}

export function createScope(fn: () => void): { dependencies: Set<Subscribable> } {
  const scope: Scope = { dependencies: new Set() };
  _scopeStack.push(scope);
  try {
    fn();
  } finally {
    _scopeStack.pop();
  }
  return scope;
}

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

let _batchDepth = 0;
const _pendingEffects = new Set<EffectNode>();

export function batch(fn: () => void): void {
  _batchDepth++;
  try {
    fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0) {
      _flushBatch();
    }
  }
}

function _flushBatch(): void {
  const effects = new Set(_pendingEffects);
  _pendingEffects.clear();
  for (const e of effects) {
    e._run();
  }
}

export function _isBatching(): boolean {
  return _batchDepth > 0;
}

export function _scheduleEffect(e: EffectNode): void {
  if (_batchDepth > 0) {
    _pendingEffects.add(e);
  } else {
    e._run();
  }
}

// ---------------------------------------------------------------------------
// ReactiveNode base
// ---------------------------------------------------------------------------

export class ReactiveNode<T> implements Subscribable {
  protected _value!: T;
  protected _subscribers = new Set<Subscriber>();

  _subscribe(sub: Subscriber): void {
    this._subscribers.add(sub);
  }

  _unsubscribe(sub: Subscriber): void {
    this._subscribers.delete(sub);
  }

  protected _trackInScope(): void {
    const scope = getCurrentScope();
    if (scope) {
      scope.dependencies.add(this);
    }
  }

  protected _notifySubscribers(): void {
    const subs = new Set(this._subscribers);
    for (const sub of subs) {
      sub._invalidate();
    }
  }
}

// ---------------------------------------------------------------------------
// SignalNode
// ---------------------------------------------------------------------------

class SignalNode<T> extends ReactiveNode<T> {
  constructor(initial: T) {
    super();
    this._value = initial;
  }

  read(): T {
    this._trackInScope();
    return this._value;
  }

  peek(): T {
    return this._value;
  }

  write(value: T): void {
    if (value === this._value) return;
    this._value = value;
    if (isDev && __devHooks.onSignalWrite) {
      __devHooks.onSignalWrite(value);
    }
    this._notifySubscribers();
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
  private _fn: () => T;
  private _dirty = true;
  private _deps = new Set<Subscribable>();
  private _computing = false;
  private _initialized = false;
  private _disposed = false;

  constructor(fn: () => T) {
    super();
    this._fn = fn;
    // Register with the nearest enclosing createRoot() so this computed is
    // disposed automatically when the owning scope tears down (component
    // unmount, For-item removal, etc.).
    if (_ownerStack.length > 0) {
      _ownerStack[_ownerStack.length - 1].push(this);
    }
  }

  read(): T {
    if (this._disposed) return this._value;
    if (this._dirty) {
      this._recompute();
    }
    this._trackInScope();
    return this._value;
  }

  private _recompute(): void {
    if (this._computing) {
      throw new Error('[stewie] Circular computed dependency detected');
    }
    this._computing = true;

    // Unsubscribe from old deps
    for (const dep of this._deps) {
      dep._unsubscribe(this);
    }
    this._deps.clear();

    const scope: Scope = { dependencies: new Set() };
    _scopeStack.push(scope);
    let newValue: T;
    try {
      newValue = this._fn();
    } finally {
      _scopeStack.pop();
      this._computing = false;
    }

    // Subscribe to new deps
    for (const dep of scope.dependencies) {
      dep._subscribe(this);
      this._deps.add(dep);
    }

    const wasInitialized = this._initialized;
    const changed = !wasInitialized || newValue !== this._value;
    this._value = newValue;
    this._dirty = false;
    this._initialized = true;

    // Only notify downstream if value actually changed (memoization)
    if (wasInitialized && changed) {
      this._notifySubscribers();
    }
  }

  _invalidate(): void {
    if (this._disposed) return;
    // Eagerly recompute — this allows us to stop propagation if value is unchanged
    // Mark dirty first so _recompute will run
    if (!this._dirty) {
      this._dirty = true;
      // Recompute eagerly to check if value changed before propagating
      // This is the key to memoization: don't notify effects if value is same
      this._recompute();
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    for (const dep of this._deps) {
      dep._unsubscribe(this);
    }
    this._deps.clear();
    this._subscribers.clear();
  }
}

// ---------------------------------------------------------------------------
// EffectNode
// ---------------------------------------------------------------------------

export class EffectNode implements Subscriber {
  private _fn: () => void | (() => void);
  private _cleanup: (() => void) | void = undefined;
  private _deps = new Set<Subscribable>();
  private _disposed = false;
  private _running = false;
  _devMeta: DevEffectMeta | undefined = undefined;
  private _isFirstRun = true;

  constructor(fn: () => void | (() => void)) {
    this._fn = fn;
    if (isDev) {
      this._devMeta = _pendingEffectMeta;
      _pendingEffectMeta = undefined;
    }
    // Register with the nearest enclosing createRoot() owner so it can
    // dispose this effect when the root is torn down (e.g. on component unmount).
    if (_ownerStack.length > 0) {
      _ownerStack[_ownerStack.length - 1].push(this);
    }
    this._run();
  }

  _run(): void {
    if (this._disposed) return;
    if (this._running) return;

    // Run cleanup from previous run
    if (typeof this._cleanup === 'function') {
      this._cleanup();
      this._cleanup = undefined;
    }

    // Unsubscribe from old deps
    for (const dep of this._deps) {
      dep._unsubscribe(this);
    }
    this._deps.clear();

    this._running = true;
    const scope: Scope = { dependencies: new Set() };
    _scopeStack.push(scope);
    let cleanup: void | (() => void);
    try {
      cleanup = this._fn() as void | (() => void);
    } finally {
      _scopeStack.pop();
      this._running = false;
    }

    this._cleanup = cleanup;

    // Subscribe to new deps
    for (const dep of scope.dependencies) {
      dep._subscribe(this);
      this._deps.add(dep);
    }

    if (isDev) {
      if (!this._isFirstRun && __devHooks.onEffectRun) {
        __devHooks.onEffectRun(this._devMeta);
      }
      this._isFirstRun = false;
    }
  }

  _invalidate(): void {
    if (this._disposed || this._running) return;
    if (_isBatching()) {
      _scheduleEffect(this);
    } else {
      this._run();
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    if (typeof this._cleanup === 'function') {
      this._cleanup();
      this._cleanup = undefined;
    }

    for (const dep of this._deps) {
      dep._unsubscribe(this);
    }
    this._deps.clear();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function signal<T>(initialValue: T): Signal<T> {
  _warnModuleScope();

  const node = new SignalNode(initialValue);

  const sig = function (): T {
    return node.read();
  } as Signal<T>;

  sig.peek = function (): T {
    return node.peek();
  };

  sig.set = function (value: T): void {
    node.write(value);
  };

  sig.update = function (fn: (current: T) => T): void {
    // Use untrack to avoid subscribing the current scope to this signal
    node.write(untrack(() => fn(node.read())));
  };

  return sig;
}

export function computed<T>(fn: () => T): Computed<T> {
  const node = new ComputedNode(fn);

  return function (): T {
    return node.read();
  };
}

export function effect(fn: () => void | (() => void)): Dispose {
  const node = new EffectNode(fn);
  return () => node.dispose();
}

/**
 * Register a cleanup function that runs when the current reactive root is disposed.
 *
 * Call inside a `createRoot()` body (or inside a component, which runs inside a root).
 * If called outside any root, the cleanup is silently ignored — there is no scope to
 * attach it to.
 *
 * ```ts
 * createRoot(() => {
 *   const ctrl = new AbortController()
 *   onCleanup(() => ctrl.abort())
 *   fetch('/api/data', { signal: ctrl.signal })
 * })
 * ```
 */
export function onCleanup(fn: () => void): void {
  const owner = _ownerStack[_ownerStack.length - 1];
  if (owner) {
    owner.push({ dispose: fn });
  }
}

/**
 * Returns the current reactive ownership scope, or `null` if called outside
 * any `createRoot()`.
 *
 * Capture the owner before the first `await` in an async function, then use
 * `runInOwner(owner, fn)` to restore ownership for async continuations so that
 * effects and cleanup functions created after `await` are tracked and disposed
 * with the root.
 *
 * ```ts
 * createRoot(async (dispose) => {
 *   const owner = getOwner()   // capture before first await
 *
 *   const data = await loadData()
 *
 *   runInOwner(owner, () => {
 *     effect(() => renderData(data))   // owned — disposed when root is disposed
 *     onCleanup(() => cleanup())       // owned — runs on dispose
 *   })
 * })
 * ```
 */
export function getOwner(): Owner | null {
  const nodes = _ownerStack[_ownerStack.length - 1];
  return nodes ? { _nodes: nodes } : null;
}

/**
 * Run `fn` with the given ownership scope active on the stack.
 * Effects, computed values, and `onCleanup` calls inside `fn` are registered
 * with `owner` and will be disposed when `owner`'s root is disposed.
 *
 * If `owner` is `null` the function runs without any owner (same as calling
 * `fn()` directly).
 *
 * See `getOwner` for the typical usage pattern.
 */
export function runInOwner<T>(owner: Owner | null, fn: () => T): T {
  if (!owner) return fn();
  _ownerStack.push(owner._nodes);
  try {
    return fn();
  } finally {
    _ownerStack.pop();
  }
}

// Run fn without registering any reactive subscriptions in the current scope.
export function untrack<T>(fn: () => T): T {
  const saved = _scopeStack.splice(0);
  try {
    return fn();
  } finally {
    _scopeStack.push(...saved);
  }
}

/**
 * Create a reactive ownership root.
 *
 * - Allows signal()/store()/computed()/effect() creation inside `fn`.
 * - Tracks every `effect()` created directly inside `fn` and registers them
 *   under this root so they can all be disposed at once.
 * - Passes a `dispose` callback to `fn`. Call it to dispose all owned effects
 *   (e.g. when the component that created this root unmounts).
 *
 * The `dispose` parameter is optional from TypeScript's perspective — existing
 * callers that use `createRoot(() => { ... })` continue to work unchanged.
 */
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const prev = _allowReactiveCreation;
  _allowReactiveCreation = true;

  const ownedNodes: Disposable[] = [];
  _ownerStack.push(ownedNodes);

  const dispose = (): void => {
    for (const n of ownedNodes) {
      n.dispose();
    }
    ownedNodes.length = 0;
  };

  try {
    return fn(dispose);
  } finally {
    _ownerStack.pop();
    _allowReactiveCreation = prev;
  }
}

/**
 * Isolate reactive module-level globals for the duration of a synchronous block.
 * Primarily used by the SSR renderer to ensure each request starts from a clean
 * reactive state and cannot leak state into or from concurrent renders.
 *
 * Saves and restores: _scopeStack, _batchDepth, _pendingEffects, _allowReactiveCreation.
 *
 * Note: For async functions passed as `fn`, isolation only covers the synchronous
 * portion before the first `await`. Full async isolation requires AsyncLocalStorage
 * (not available in all WinterCG environments). The primary benefit here is correct
 * initial state and cleanup on synchronous error paths.
 */
export function withRenderIsolation<T>(fn: () => T): T {
  // Save current module-level state
  const savedScope = _scopeStack.splice(0); // empties the array, returns removed items
  const savedBatchDepth = _batchDepth;
  const savedPendingEffects = new Set(_pendingEffects);
  const savedAllow = _allowReactiveCreation;

  // Start with a clean state and allow signal/store creation in components
  _batchDepth = 0;
  _pendingEffects.clear();
  _allowReactiveCreation = true;

  try {
    return fn();
  } finally {
    // Restore previous state
    _scopeStack.splice(0);
    _scopeStack.push(...savedScope);
    _batchDepth = savedBatchDepth;
    _pendingEffects.clear();
    for (const e of savedPendingEffects) _pendingEffects.add(e);
    _allowReactiveCreation = savedAllow;
  }
}
