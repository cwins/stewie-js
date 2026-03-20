// store.ts — reactive store using Proxy

import {
  isDev,
  _allowReactiveCreation,
  getCurrentScope,
  Subscribable,
  Subscriber,
  batch,
} from './reactive.js'

// ---------------------------------------------------------------------------
// StoreNode — reactive node for a single store path
// ---------------------------------------------------------------------------

class StoreNode implements Subscribable {
  private _subscribers = new Set<Subscriber>()

  _subscribe(sub: Subscriber): void {
    this._subscribers.add(sub)
  }

  _unsubscribe(sub: Subscriber): void {
    this._subscribers.delete(sub)
  }

  _notify(): void {
    const subs = new Set(this._subscribers)
    for (const sub of subs) {
      sub._invalidate()
    }
  }
}

// ---------------------------------------------------------------------------
// Proxy factory
// ---------------------------------------------------------------------------

type PathNodeMap = Map<string, StoreNode>

function getOrCreateNode(nodeMap: PathNodeMap, path: string): StoreNode {
  let node = nodeMap.get(path)
  if (!node) {
    node = new StoreNode()
    nodeMap.set(path, node)
  }
  return node
}

function trackNode(nodeMap: PathNodeMap, path: string): void {
  const scope = getCurrentScope()
  if (!scope) return

  const node = getOrCreateNode(nodeMap, path)
  scope.dependencies.add(node)
}

function makeProxy<T extends object>(
  target: T,
  nodeMap: PathNodeMap,
  path: string
): T {
  return new Proxy(target, {
    get(obj: T, key: string | symbol): unknown {
      // Pass through symbols (like Symbol.iterator, Symbol.toPrimitive, etc.)
      if (typeof key === 'symbol') {
        return (obj as Record<string | symbol, unknown>)[key]
      }

      const fullPath = path ? `${path}.${key}` : key

      // Track subscription for this property path
      trackNode(nodeMap, fullPath)

      const value = (obj as Record<string, unknown>)[key]

      // Handle array mutation methods — intercept to trigger notifications
      if (Array.isArray(obj) && typeof value === 'function') {
        const mutatingMethods = new Set([
          'push', 'pop', 'shift', 'unshift', 'splice',
          'sort', 'reverse', 'fill', 'copyWithin'
        ])
        if (mutatingMethods.has(key)) {
          return function (this: unknown, ...args: unknown[]) {
            let result: unknown
            // Use batch to consolidate all notifications from the mutation
            batch(() => {
              result = (value as Function).apply(obj, args)

              // Notify the array's own node (parent path that holds the array)
              if (nodeMap.has(path)) {
                nodeMap.get(path)!._notify()
              }

              // Notify all nodes under this array path (index nodes, length node)
              const prefix = path ? `${path}.` : ''
              for (const [nodePath, node] of nodeMap) {
                if (nodePath !== path && nodePath.startsWith(prefix)) {
                  node._notify()
                }
              }
            })
            return result
          }
        }
      }

      // Recursively proxy nested objects/arrays
      if (value !== null && typeof value === 'object') {
        return makeProxy(value as object, nodeMap, fullPath)
      }

      return value
    },

    set(obj: T, key: string | symbol, value: unknown): boolean {
      if (typeof key === 'symbol') {
        ;(obj as Record<string | symbol, unknown>)[key] = value
        return true
      }

      const fullPath = path ? `${path}.${key}` : key
      ;(obj as Record<string, unknown>)[key] = value

      // Notify subscribers of this exact path only
      // (changing a.b does NOT notify a.c subscribers)
      if (nodeMap.has(fullPath)) {
        nodeMap.get(fullPath)!._notify()
      }

      return true
    }
  })
}

// ---------------------------------------------------------------------------
// store() — public API
// ---------------------------------------------------------------------------

export function store<T extends object>(initial: T): T {
  if (isDev && !_allowReactiveCreation && getCurrentScope() === null) {
    console.warn(
      '[stewie] signal()/store() called at module scope. Reactive primitives must be created inside components or lifecycle hooks.'
    )
  }

  const nodeMap: PathNodeMap = new Map()
  return makeProxy(initial, nodeMap, '')
}
