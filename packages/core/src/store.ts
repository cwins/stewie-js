// store.ts — reactive store using Proxy

import {
  isDev,
  __devHooks,
  _allowReactiveCreation,
  _callerFrame,
  getCurrentScope,
  Subscribable,
  Subscriber,
  batch
} from './reactive.js';

// ---------------------------------------------------------------------------
// StoreNode — reactive node for a single store path
// ---------------------------------------------------------------------------

class StoreNode implements Subscribable {
  private _subscribers = new Set<Subscriber>();

  _subscribe(sub: Subscriber): void {
    this._subscribers.add(sub);
  }

  _unsubscribe(sub: Subscriber): void {
    this._subscribers.delete(sub);
  }

  _notify(): void {
    const subs = new Set(this._subscribers);
    for (const sub of subs) {
      sub._invalidate();
    }
  }
}

// ---------------------------------------------------------------------------
// Proxy factory
// ---------------------------------------------------------------------------

type PathNodeMap = Map<string, StoreNode>;

/**
 * Two-level cache: WeakMap<targetObject, Map<path, proxy>>.
 *
 * Keyed by both the raw target object AND the path so that the same object
 * referenced at two different store paths (e.g. store.a = store.b = shared)
 * gets separate proxies with the correct subscription paths for each.
 *
 * WeakMap ensures that when the target object is garbage-collected (e.g. after
 * a store property is overwritten) the cached proxy is collected too — no leak.
 */
type ProxyCache = WeakMap<object, Map<string, object>>;

/**
 * Reverse map: proxy → raw target.
 *
 * Prevents double-wrapping when a store-proxied object ends up stored back
 * inside the same store array (e.g. `store.tasks = store.tasks.map(t => t)`).
 * On re-read, makeProxy detects the existing proxy, resolves its raw target,
 * and returns the already-cached proxy for that (rawTarget, path) pair.
 */
type ProxyTargetMap = WeakMap<object, object>;

function getOrCreateNode(nodeMap: PathNodeMap, path: string): StoreNode {
  let node = nodeMap.get(path);
  if (!node) {
    node = new StoreNode();
    nodeMap.set(path, node);
  }
  return node;
}

function trackNode(nodeMap: PathNodeMap, path: string): void {
  const scope = getCurrentScope();
  if (!scope) return;

  const node = getOrCreateNode(nodeMap, path);
  scope.dependencies.add(node);
}

function makeProxy<T extends object>(
  target: T,
  nodeMap: PathNodeMap,
  path: string,
  proxyCache: ProxyCache,
  proxyTargetMap: ProxyTargetMap
): T {
  // If target is already a proxy created by this store, unwrap it to the raw
  // object so the (rawTarget, path) cache lookup works correctly and we never
  // produce a Proxy-of-a-Proxy. This happens when store array elements are
  // proxy objects (e.g. after `store.tasks = store.tasks.map(t => t)`).
  const rawTarget = (proxyTargetMap.get(target) as T | undefined) ?? target;

  // Return a cached proxy when the same (rawTarget, path) pair is seen again.
  // This gives stable referential identity: store.user === store.user.
  let pathMap = proxyCache.get(rawTarget);
  if (pathMap) {
    const cached = pathMap.get(path);
    if (cached) return cached as T;
  }

  const proxy = new Proxy(rawTarget, {
    get(obj: T, key: string | symbol): unknown {
      // Pass through symbols (like Symbol.iterator, Symbol.toPrimitive, etc.)
      if (typeof key === 'symbol') {
        return (obj as Record<string | symbol, unknown>)[key];
      }

      const fullPath = path ? `${path}.${key}` : key;

      // Track subscription for this property path
      trackNode(nodeMap, fullPath);

      const value = (obj as Record<string, unknown>)[key];

      // Handle array mutation methods — intercept to trigger notifications
      if (Array.isArray(obj) && typeof value === 'function') {
        const mutatingMethods = new Set([
          'push',
          'pop',
          'shift',
          'unshift',
          'splice',
          'sort',
          'reverse',
          'fill',
          'copyWithin'
        ]);
        if (mutatingMethods.has(key)) {
          return function (this: unknown, ...args: unknown[]) {
            let result: unknown;
            // Use batch to consolidate all notifications from the mutation
            batch(() => {
              result = (value as Function).apply(obj, args);

              // Notify the array's own node (parent path that holds the array)
              if (nodeMap.has(path)) {
                nodeMap.get(path)!._notify();
              }

              // Notify all nodes under this array path (index nodes, length node)
              const prefix = path ? `${path}.` : '';
              for (const [nodePath, node] of nodeMap) {
                if (nodePath !== path && nodePath.startsWith(prefix)) {
                  node._notify();
                }
              }
            });
            return result;
          };
        }
      }

      // Recursively proxy nested objects/arrays — use the cache to preserve identity
      if (value !== null && typeof value === 'object') {
        return makeProxy(value as object, nodeMap, fullPath, proxyCache, proxyTargetMap);
      }

      return value;
    },

    set(obj: T, key: string | symbol, value: unknown): boolean {
      if (typeof key === 'symbol') {
        (obj as Record<string | symbol, unknown>)[key] = value;
        return true;
      }

      const fullPath = path ? `${path}.${key}` : key;

      // Invalidate any cached proxy for the old value at this path so that
      // subsequent reads of this property create a fresh proxy for the new value.
      const oldValue = (obj as Record<string, unknown>)[key];
      if (oldValue !== null && typeof oldValue === 'object') {
        // Unwrap if the stored value is itself a proxy from this store
        const rawOldValue = (proxyTargetMap.get(oldValue as object) as object | undefined) ?? (oldValue as object);
        const oldPathMap = proxyCache.get(rawOldValue);
        if (oldPathMap) oldPathMap.delete(fullPath);
      }

      (obj as Record<string, unknown>)[key] = value;

      if (isDev && __devHooks.onStoreWrite) {
        __devHooks.onStoreWrite(fullPath, oldValue, value, _callerFrame());
      }

      // Notify subscribers of this exact path only
      // (changing a.b does NOT notify a.c subscribers)
      if (nodeMap.has(fullPath)) {
        nodeMap.get(fullPath)!._notify();
      }

      return true;
    }
  });

  // Store in cache before returning
  if (!pathMap) {
    pathMap = new Map();
    proxyCache.set(rawTarget, pathMap);
  }
  pathMap.set(path, proxy);
  // Register the reverse mapping so future makeProxy(proxy, ...) calls can unwrap
  proxyTargetMap.set(proxy, rawTarget);

  return proxy;
}

// ---------------------------------------------------------------------------
// store() — public API
// ---------------------------------------------------------------------------

export function store<T extends object>(initial: T): T {
  if (isDev && !_allowReactiveCreation && getCurrentScope() === null) {
    console.warn(
      '[stewie] signal()/store() called at module scope. Reactive primitives must be created inside components or lifecycle hooks.'
    );
  }

  const nodeMap: PathNodeMap = new Map();
  const proxyCache: ProxyCache = new WeakMap();
  const proxyTargetMap: ProxyTargetMap = new WeakMap();
  return makeProxy(initial, nodeMap, '', proxyCache, proxyTargetMap);
}
