/**
 * stream.ts — progressive streaming SSR renderer
 *
 * Produces a ReadableStream<Uint8Array> that sends chunks to the browser
 * incrementally as they become available:
 *
 *   1. Native element opening tags are flushed immediately, so the browser
 *      can start parsing structure and loading linked resources (<link>, <script>)
 *      without waiting for the full page render.
 *
 *   2. Suspense boundaries stream their fallback content first, then inject
 *      the resolved content inline via a small <script> swap once it's ready.
 *      This means above-the-fold content (nav, hero) streams before slow
 *      data-fetching subtrees finish.
 *
 *   3. The __STEWIE_STATE__ hydration script is flushed last, after all
 *      Suspense boundaries have resolved.
 */

import type { JSXElement } from '@stewie-js/core';
import {
  Fragment,
  Show,
  For,
  Switch,
  Match,
  Portal,
  ErrorBoundary,
  Suspense,
  ClientOnly,
  runWithContext,
  withRenderIsolation,
  reactiveScope,
  _LazyBoundary
} from '@stewie-js/core';
import type { ContextProvider, ContextSnapshot, _LazyBoundaryProps } from '@stewie-js/core';
import type { RenderToStreamOptions } from './types.js';
import { createHydrationRegistry, HydrationRegistryContext } from './hydration.js';
import type { HydrationRegistry } from './hydration.js';
import { VOID_ELEMENTS, escapeHtml, serializeAttrs } from './serializer.js';

// ---------------------------------------------------------------------------
// Internal streaming render context
// ---------------------------------------------------------------------------

interface StreamOpts {
  nonce?: string;
  registry: HydrationRegistry;
  contextSnapshot: ContextSnapshot;
  /** Enqueue a chunk immediately — use for sync/ready content. */
  flush: (html: string) => void;
  /** Queue an async boundary to run after the main tree. */
  defer: (work: () => Promise<void>) => void;
  /** Counter for unique Suspense boundary IDs. */
  suspenseId: { n: number };
}

// ---------------------------------------------------------------------------
// Streaming node renderer
// ---------------------------------------------------------------------------

async function streamNode(node: unknown, opts: StreamOpts): Promise<void> {
  if (node instanceof Promise) node = await node;

  if (node === null || node === undefined || node === false || node === true) return;

  if (typeof node === 'string') {
    opts.flush(escapeHtml(node));
    return;
  }

  if (typeof node === 'number') {
    opts.flush(escapeHtml(String(node)));
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) await streamNode(child, opts);
    return;
  }

  if (typeof node === 'function') {
    // One level of folding matches the dom-renderer's Signal child folding: if the
    // outer function returns another function (e.g. () => item().label where .label
    // is a Signal<string>), call through once more in the same slot so both paths
    // emit exactly one <!----> anchor for this child position.
    let value = (node as () => unknown)();
    if (typeof value === 'function') value = (value as () => unknown)();
    await streamNode(value, opts);
    opts.flush('<!---->');
    return;
  }

  const el = node as JSXElement;
  const { type, props } = el;

  // Fragment
  if (type === Fragment) {
    if (props.children !== undefined && props.children !== null) {
      await streamNode(props.children, opts);
    }
    return;
  }

  // Show — emit trailing anchor to match the string renderer and the DOM renderer's
  // comment node so that HydrationCursor.collectUntilComment('Show') finds it.
  if (type === (Show as unknown)) {
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when;
    if (when) {
      await streamNode(props.children, opts);
    } else if (props.fallback !== undefined) {
      await streamNode(props.fallback, opts);
    }
    opts.flush('<!--Show-->');
    return;
  }

  // For — same: trailing anchor required for HydrationCursor.
  if (type === (For as unknown)) {
    const each = typeof props.each === 'function' ? (props.each as () => unknown[])() : (props.each as unknown[]);
    if (Array.isArray(each)) {
      const renderFn = props.children as (item: () => unknown, index: () => number) => JSXElement;
      for (let i = 0; i < each.length; i++)
        await streamNode(
          renderFn(
            () => each[i],
            () => i
          ),
          opts
        );
    }
    opts.flush('<!--For-->');
    return;
  }

  // ClientOnly — skip on server
  if (type === (ClientOnly as unknown)) return;

  // LazyBoundary — emit <!--Lazy--> anchor to match the string renderer and DOM renderer
  if (type === (_LazyBoundary as unknown)) {
    const lazyProps = props as unknown as _LazyBoundaryProps;
    if (lazyProps.loaded()) {
      await streamNode(lazyProps.render(), opts);
    }
    opts.flush('<!--Lazy-->');
    return;
  }

  // Portal — render children inline
  if (type === (Portal as unknown)) {
    await streamNode(props.children, opts);
    return;
  }

  // ErrorBoundary
  if (type === (ErrorBoundary as unknown)) {
    try {
      await streamNode(props.children, opts);
    } catch (err) {
      const fallbackFn = props.fallback as (err: unknown) => JSXElement;
      await streamNode(fallbackFn(err), opts);
    }
    return;
  }

  // Switch / Match — emit <!--Switch--> anchor on every path to match the string
  // renderer and DOM renderer so HydrationCursor.collectUntilComment('Switch') works.
  if (type === (Switch as unknown)) {
    const children = Array.isArray(props.children) ? props.children : [props.children];
    for (const child of children as JSXElement[]) {
      if (!child || child.type !== (Match as unknown)) continue;
      const mp = child.props as {
        when: unknown;
        children: JSXElement | ((v: unknown) => JSXElement);
      };
      const when = typeof mp.when === 'function' ? (mp.when as () => unknown)() : mp.when;
      if (when) {
        const content = typeof mp.children === 'function' ? (mp.children as (v: unknown) => JSXElement)(when) : mp.children;
        await streamNode(content, opts);
        opts.flush('<!--Switch-->');
        return;
      }
    }
    if (props.fallback !== undefined) await streamNode(props.fallback, opts);
    opts.flush('<!--Switch-->');
    return;
  }

  if (type === (Match as unknown)) {
    const when = typeof props.when === 'function' ? (props.when as () => unknown)() : props.when;
    if (when) {
      const content = typeof props.children === 'function' ? (props.children as (v: unknown) => JSXElement)(when) : props.children;
      await streamNode(content, opts);
    }
    return;
  }

  // Suspense — stream fallback immediately, resolve content as a deferred chunk
  if (type === (Suspense as unknown)) {
    const id = opts.suspenseId.n++;
    const placeholderId = `__ss${id}`;

    // Capture context snapshot now so the deferred render has the right context
    const deferredSnapshot = new Map(opts.contextSnapshot);

    // Render fallback synchronously and flush it wrapped in a placeholder element
    const fallbackChunks: string[] = [];
    const fallbackFlush = (html: string) => fallbackChunks.push(html);
    try {
      await streamNode(props.fallback, { ...opts, flush: fallbackFlush });
    } catch {
      // If fallback fails, stream nothing
    }
    opts.flush(`<div id="${placeholderId}">${fallbackChunks.join('')}</div>`);

    // Defer resolution of real content — runs after the main tree is flushed
    opts.defer(async () => {
      const realChunks: string[] = [];
      const realFlush = (html: string) => realChunks.push(html);
      try {
        await streamNode(props.children, {
          ...opts,
          flush: realFlush,
          contextSnapshot: deferredSnapshot
        });
      } catch {
        return; // Leave fallback in place on error
      }

      const realHtml = realChunks.join('');
      const nonceAttr = opts.nonce ? ` nonce="${escapeHtml(opts.nonce)}"` : '';
      // Inject content and swap out the placeholder via an inline script.
      // Using textContent assignment avoids issues with scripts inside innerHTML.
      const swapScript = `
<template id="${placeholderId}t">${realHtml}</template>
<script${nonceAttr}>(function(){var s=document.getElementById("${placeholderId}"),t=document.getElementById("${placeholderId}t");if(s&&t){s.outerHTML=t.innerHTML;t.remove()}})()</script>`;
      opts.flush(swapScript);
    });
    return;
  }

  // Context.Provider
  if (
    type != null &&
    (typeof type === 'function' || typeof type === 'object') &&
    (type as unknown as ContextProvider<unknown>)._isProvider
  ) {
    const provider = type as unknown as ContextProvider<unknown>;
    const newSnapshot = new Map(opts.contextSnapshot);
    newSnapshot.set(provider._context.id, props.value);
    await streamNode(props.children, { ...opts, contextSnapshot: newSnapshot });
    return;
  }

  // Component function
  if (typeof type === 'function') {
    let result: JSXElement | null = null;
    reactiveScope(() => {
      runWithContext(opts.contextSnapshot, () => {
        result = (type as (props: Record<string, unknown>) => JSXElement | null)(props);
      });
    });
    await streamNode(result, opts);
    return;
  }

  // Native HTML element — flush opening tag immediately so the browser can
  // start parsing structure and loading resources without waiting for children.
  if (typeof type === 'string') {
    const attrs = serializeAttrs(props);
    if (VOID_ELEMENTS.has(type)) {
      opts.flush(`<${type}${attrs} />`);
      return;
    }
    opts.flush(`<${type}${attrs}>`);
    if (props.children !== undefined) await streamNode(props.children, opts);
    opts.flush(`</${type}>`);
    return;
  }
}

// ---------------------------------------------------------------------------
// Public renderToStream
// ---------------------------------------------------------------------------

export function renderToStream(root: JSXElement | (() => JSXElement | null), options?: RenderToStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const flush = (html: string) => {
        if (html) controller.enqueue(encoder.encode(html));
      };

      try {
        await withRenderIsolation(async () => {
          const registry = createHydrationRegistry();
          const contextSnapshot: ContextSnapshot = new Map([[HydrationRegistryContext.id, registry]]);

          const deferred: Array<() => Promise<void>> = [];

          const opts: StreamOpts = {
            nonce: options?.nonce,
            registry,
            contextSnapshot,
            flush,
            defer: (work) => deferred.push(work),
            suspenseId: { n: 0 }
          };

          const rootEl = typeof root === 'function' ? root() : root;
          await streamNode(rootEl, opts);

          // Resolve deferred Suspense boundaries in order
          for (const work of deferred) await work();

          // Flush hydration state last — escape </script> to prevent XSS breakout
          const stateJson = registry.serialize().replace(/<\//g, '<\\/');
          const nonceAttr = options?.nonce ? ` nonce="${escapeHtml(options.nonce)}"` : '';
          flush(`<script${nonceAttr}>window.__STEWIE_STATE__ = ${stateJson}</script>`);
        });

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    }
  });
}
