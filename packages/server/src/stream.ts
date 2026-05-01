/**
 * stream.ts — SSR renderer.
 *
 * One walker, two delivery modes. The walker is `streamNode`; the public
 * entry points are `renderToStream` (progressive) and `renderToString`
 * (buffered). They share registries, head collection, asset emission, and
 * control-flow handling — the only behavioural fork is at Suspense:
 *
 *   - streaming mode: flush the fallback wrapped in a placeholder div, defer
 *     the boundary's children, and emit a swap script + per-boundary data
 *     patch when the children resolve. Above-the-fold content streams before
 *     slow data-fetching subtrees finish.
 *
 *   - await mode: render the boundary's children inline; if a child throws a
 *     Promise, await and retry up to MAX_RETRIES, falling back on persistent
 *     suspension. No defer, no swap script, no per-boundary patch — the
 *     end-of-render `__STEWIE_DATA__` assignment carries everything.
 *
 * `renderToString` runs the walker in await mode against a string buffer and
 * pulls the head/state pieces out separately. `renderToStream` runs the
 * walker in streaming mode against a `ReadableStream<Uint8Array>` and flushes
 * head/state inline. Both use the same chunk-flush callback shape, so any
 * walker change applies uniformly.
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
  _LazyBoundary,
  Head,
  HeadContext,
  createHeadCollector,
  createDataRegistry,
  DataRegistryContext
} from '@stewie-js/core';
import type { DataRegistry, HeadCollector } from '@stewie-js/core';
import type { ContextProvider, ContextSnapshot, _LazyBoundaryProps } from '@stewie-js/core';
import type { RenderToStreamOptions, RenderToStringOptions, RenderResult, SSRManifest } from './types.js';
import { createHydrationRegistry, HydrationRegistryContext, type HydrationRegistry } from './hydration.js';
import { VOID_ELEMENTS, escapeHtml, serializeAttrs } from './serializer.js';
import { serializeHeadEntries, serializeHeadPatch } from './head-serializer.js';

// ---------------------------------------------------------------------------
// Internal render context
// ---------------------------------------------------------------------------

interface StreamOpts {
  nonce?: string;
  registry: HydrationRegistry;
  dataRegistry: DataRegistry;
  headCollector: HeadCollector;
  contextSnapshot: ContextSnapshot;
  /** Enqueue a chunk immediately — use for sync/ready content. */
  flush: (html: string) => void;
  /** Queue an async boundary to run after the main tree (streaming mode only). */
  defer: (work: () => Promise<void>) => void;
  /** Counter for unique Suspense boundary IDs (streaming mode only). */
  suspenseId: { n: number };
  /** Vite SSR manifest for progressive `<link>` emission per lazy boundary. */
  manifest?: SSRManifest;
  /** Asset URLs already emitted in this render — prevents duplicate `<link>` tags. */
  emittedAssets: Set<string>;
  /**
   * Lazy boundary ids that were visited during this render. Populated by
   * emitLazyAssets. Used to emit a filtered __STEWIE_MANIFEST__ global
   * containing only the boundaries actually rendered (not the full manifest).
   */
  renderedLazyIds: Set<string>;
  /**
   * Suspense strategy: when true, await children inline (with throw-Promise
   * retry); when false, defer children and emit a swap script. Set by the
   * public entry point — `renderToString` uses true, `renderToStream` uses false.
   */
  awaitSuspense: boolean;
  /**
   * When set, lazy-boundary `<link>` hints push here instead of flushing
   * inline. `renderToString` uses this to lift hints into the returned
   * `headHtml` so callers can inject them into `<head>` rather than the body.
   */
  assetSink?: string[];
}

// ---------------------------------------------------------------------------
// Lazy boundary asset emission
// ---------------------------------------------------------------------------

/**
 * Emit `<link>` hints for any assets a lazy boundary's chunk pulls in:
 *   - CSS    → `<link rel="stylesheet">`  (blocks paint until loaded — required
 *              for unstyled-content avoidance when the chunk is also styled)
 *   - JS/MJS → `<link rel="modulepreload">` (warms the module graph in parallel
 *              with the rest of the stream so the dynamic import() the client
 *              issues at hydration is already in cache)
 *
 * Deduped against assets already emitted earlier in the stream so two Lazy
 * boundaries that share a chunk only emit one tag for it. No-op when no
 * manifest is configured or the boundary has no `id` (compiler-off).
 *
 * Routing: by default flushes inline (streaming mode places hints just before
 * the boundary in body order, which the browser tolerates for `<link>`); when
 * `assetSink` is set (await mode), pushes there instead so the caller can
 * relocate the tags into `<head>` of the page shell.
 */
function emitLazyAssets(id: string | undefined, opts: StreamOpts): void {
  if (!id || !opts.manifest) return;
  const assets = opts.manifest[id];
  if (!assets) return;
  // Track this id so buildStateScript can emit a filtered __STEWIE_MANIFEST__.
  opts.renderedLazyIds.add(id);
  for (const href of assets) {
    if (opts.emittedAssets.has(href)) continue;
    let tag: string | null = null;
    if (href.endsWith('.css')) {
      tag = `<link rel="stylesheet" href="${escapeHtml(href)}">`;
    } else if (href.endsWith('.js') || href.endsWith('.mjs')) {
      tag = `<link rel="modulepreload" href="${escapeHtml(href)}">`;
    }
    if (!tag) continue;
    opts.emittedAssets.add(href);
    if (opts.assetSink) opts.assetSink.push(tag);
    else opts.flush(tag);
  }
}

// ---------------------------------------------------------------------------
// Walker
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

  // Show — emit trailing anchor to match the DOM renderer's comment node so that
  // HydrationCursor.collectUntilComment('Show') finds it.
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

  // LazyBoundary — emit <!--Lazy--> anchor to match the DOM renderer.
  if (type === (_LazyBoundary as unknown)) {
    const lazyProps = props as unknown as _LazyBoundaryProps;
    emitLazyAssets(lazyProps.id, opts);
    if (lazyProps.loaded()) {
      await streamNode(lazyProps.render(), opts);
    }
    opts.flush('<!--Lazy-->');
    return;
  }

  // Portal — render children inline (target is client-only)
  if (type === (Portal as unknown)) {
    await streamNode(props.children, opts);
    return;
  }

  // Head — render children inline; useTitle/useMeta inside them register with HeadContext
  if (type === (Head as unknown)) {
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

  // Switch / Match — emit <!--Switch--> anchor on every path so HydrationCursor can claim.
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

  // Suspense — two strategies, branch on opts.awaitSuspense.
  if (type === (Suspense as unknown)) {
    if (opts.awaitSuspense) {
      // Await mode: render children inline; on a thrown Promise (suspended
      // resource read), await it and retry up to MAX_RETRIES. Buffer the
      // children's flushes so a partial render that ends up suspending
      // doesn't leak into the output before the retry.
      //
      // Important: For retry to terminate, the resource() that throws must be
      // created OUTSIDE the component function so the same instance is reused
      // on retry. When created inside, each retry creates a new resource and
      // a new Promise — retries are capped and the fallback is rendered.
      const MAX_RETRIES = 3;
      let retries = 0;
      const seenPromises = new Set<Promise<unknown>>();
      const tryRender = async (): Promise<void> => {
        const captured: string[] = [];
        const localFlush = (s: string) => captured.push(s);
        try {
          await streamNode(props.children, { ...opts, flush: localFlush });
          opts.flush(captured.join(''));
        } catch (thrown) {
          if (thrown instanceof Promise && !seenPromises.has(thrown) && retries < MAX_RETRIES) {
            seenPromises.add(thrown);
            retries++;
            try {
              await thrown;
            } catch {
              // Promise rejected — render fallback inline.
              await streamNode(props.fallback, opts);
              return;
            }
            return tryRender();
          }
          // Non-Promise throw, repeated Promise, or retry limit reached → fallback.
          await streamNode(props.fallback, opts);
        }
      };
      await tryRender();
      opts.flush('<!--Suspense-->');
      return;
    }

    // Streaming mode: flush fallback immediately, resolve content as a deferred chunk.
    //
    // Inline data emission per boundary: snapshot the DataRegistry keys before the
    // boundary's deferred work starts; after the work resolves, diff to find any
    // new keys and emit `Object.assign(window.__STEWIE_DATA__, ...)` patches inline
    // alongside the swap script. The patches land before the swap replaces the
    // fallback DOM, so any reactive read triggered by the swap sees cached data.
    const id = opts.suspenseId.n++;
    const placeholderId = `__ss${id}`;
    const keysBeforeBoundary = new Set(opts.dataRegistry.keys());

    // Capture context snapshot now so the deferred render has the right context.
    // Boundary-local head collector lets us emit a head patch alongside the
    // boundary's content flush — e.g. a lazy component that derives a page title
    // from fetched data updates the title when its data resolves.
    const boundaryHeadCollector = createHeadCollector();
    const deferredSnapshot = new Map(opts.contextSnapshot);
    deferredSnapshot.set(HeadContext.id, boundaryHeadCollector);

    // Render fallback synchronously and flush it wrapped in a placeholder element.
    // The trailing <!--Suspense--> anchor sits *outside* the placeholder div so it
    // survives the eventual outerHTML swap that replaces the div — HydrationCursor
    // walks the DOM looking for the anchor regardless of whether hydration runs
    // before or after the swap script fires.
    const fallbackChunks: string[] = [];
    const fallbackFlush = (html: string) => fallbackChunks.push(html);
    try {
      await streamNode(props.fallback, { ...opts, flush: fallbackFlush });
    } catch {
      // If fallback fails, stream nothing
    }
    opts.flush(`<div id="${placeholderId}">${fallbackChunks.join('')}</div><!--Suspense-->`);

    // Defer resolution of real content — runs after the main tree is flushed
    opts.defer(async () => {
      const realChunks: string[] = [];
      const realFlush = (html: string) => realChunks.push(html);
      try {
        await streamNode(props.children, {
          ...opts,
          headCollector: boundaryHeadCollector,
          flush: realFlush,
          contextSnapshot: deferredSnapshot
        });
      } catch {
        return; // Leave fallback in place on error
      }

      const realHtml = realChunks.join('');
      const nonceAttr = opts.nonce ? ` nonce="${escapeHtml(opts.nonce)}"` : '';

      // Emit DataRegistry patch for keys written during this boundary's render.
      // Lands in window.__STEWIE_DATA__ before the swap so registry-aware
      // hydration logic (e.g. nested Suspense reads inside the swapped content)
      // sees cached data synchronously.
      const newKeys = opts.dataRegistry.keys().filter((k) => !keysBeforeBoundary.has(k));
      let dataPatchScript = '';
      if (newKeys.length > 0) {
        const patchObj: Record<string, unknown> = {};
        for (const k of newKeys) patchObj[k] = opts.dataRegistry.get(k);
        const patchJson = JSON.stringify(patchObj).replace(/<\//g, '<\\/');
        dataPatchScript = `<script${nonceAttr}>(window.__STEWIE_DATA__=window.__STEWIE_DATA__||{});Object.assign(window.__STEWIE_DATA__,${patchJson})</script>`;
      }

      const swapScript = `${dataPatchScript}
<template id="${placeholderId}t">${realHtml}</template>
<script${nonceAttr}>(function(){var s=document.getElementById("${placeholderId}"),t=document.getElementById("${placeholderId}t");if(s&&t){s.outerHTML=t.innerHTML;t.remove()}})()</script>`;
      opts.flush(swapScript);

      // Emit head patch — title / meta updates from within this Suspense boundary
      const headPatch = serializeHeadPatch(boundaryHeadCollector.entries(), opts.nonce);
      if (headPatch) opts.flush(headPatch);
    });
    return;
  }

  // Context.Provider — extend the snapshot with the new value for child rendering
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

  // Native HTML element
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
// Shared setup — used by both renderToStream and renderToString.
// ---------------------------------------------------------------------------

interface RenderHandle {
  registry: HydrationRegistry;
  dataRegistry: DataRegistry;
  headCollector: HeadCollector;
  renderedLazyIds: Set<string>;
  manifest?: SSRManifest;
}

async function runRender(
  root: JSXElement | (() => JSXElement | null),
  options: RenderToStreamOptions | RenderToStringOptions | undefined,
  flush: (html: string) => void,
  awaitSuspense: boolean,
  assetSink?: string[]
): Promise<RenderHandle> {
  // withRenderIsolation clears reactive module-level globals (scopeStack, batchDepth,
  // pendingEffects) and sets allowReactiveCreation=true for the synchronous setup phase,
  // then restores them when the async function returns its Promise. Prevents state
  // leakage between concurrent renders during their synchronous portions.
  return withRenderIsolation(async () => {
    const registry = createHydrationRegistry();
    const headCollector = createHeadCollector();
    // The DataRegistry is created inside the render isolation scope so its
    // store() is owned by this request — no cross-request leakage. The same
    // instance is provided via context (so useResource consults it) and
    // serialized at end-of-render into window.__STEWIE_DATA__ for the client.
    const dataRegistry = createDataRegistry();
    const contextSnapshot: ContextSnapshot = new Map<symbol, unknown>([
      [HydrationRegistryContext.id, registry],
      [HeadContext.id, headCollector],
      [DataRegistryContext.id, dataRegistry]
    ]);

    const deferred: Array<() => Promise<void>> = [];

    const renderedLazyIds = new Set<string>();
    const opts: StreamOpts = {
      nonce: options?.nonce,
      registry,
      dataRegistry,
      headCollector,
      contextSnapshot,
      flush,
      defer: (work) => deferred.push(work),
      suspenseId: { n: 0 },
      manifest: options?.manifest,
      emittedAssets: new Set<string>(),
      renderedLazyIds,
      awaitSuspense,
      assetSink
    };

    const rootEl = typeof root === 'function' ? root() : root;
    await streamNode(rootEl, opts);

    // Streaming-only post-walk steps. Await mode never enqueues to `deferred`
    // (Suspense renders inline) and emits head/state via the wrapper instead.
    if (!awaitSuspense) {
      // Shell-level head tags emitted immediately after the main tree (before
      // deferred work) so title/meta set by non-Suspense components land early.
      const shellHeadHtml = serializeHeadEntries(headCollector.entries());
      if (shellHeadHtml) flush(shellHeadHtml);
      for (const work of deferred) await work();
    }

    return { registry, dataRegistry, headCollector, renderedLazyIds, manifest: options?.manifest };
  });
}

function buildStateScript(handle: RenderHandle, nonce: string | undefined, mergeExisting: boolean): string {
  // Escape </script> to prevent XSS breakout.
  const stateJson = handle.registry.serialize().replace(/<\//g, '<\\/');
  const dataJson = handle.dataRegistry.serialize().replace(/<\//g, '<\\/');
  const nonceAttr = nonce ? ` nonce="${escapeHtml(nonce)}"` : '';
  // Streaming mode: per-boundary patches may have populated window.__STEWIE_DATA__
  // before this final assignment lands, so merge into any existing object.
  // Await mode: this is the only assignment, so a plain set is correct.
  const dataExpr = mergeExisting ? `Object.assign(${dataJson}, window.__STEWIE_DATA__ || {})` : dataJson;

  // Emit a filtered manifest containing only lazy boundary ids visited during
  // this render. The client uses this to know which CSS/JS URLs belong to each
  // boundary id — needed for Phase 2 hydration gating. Emitting only rendered
  // ids (not the full manifest) keeps the payload proportional to actual output.
  let manifestExpr = '';
  if (handle.manifest && handle.renderedLazyIds.size > 0) {
    const filtered: SSRManifest = {};
    for (const id of handle.renderedLazyIds) {
      if (handle.manifest[id]) filtered[id] = handle.manifest[id];
    }
    const manifestJson = JSON.stringify(filtered).replace(/<\//g, '<\\/');
    manifestExpr = `;window.__STEWIE_MANIFEST__ = ${manifestJson}`;
  }

  return `<script${nonceAttr}>window.__STEWIE_STATE__ = ${stateJson};window.__STEWIE_DATA__ = ${dataExpr}${manifestExpr}</script>`;
}

// ---------------------------------------------------------------------------
// Public renderToStream — progressive delivery.
// ---------------------------------------------------------------------------

export function renderToStream(root: JSXElement | (() => JSXElement | null), options?: RenderToStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const flush = (html: string) => {
        if (html) controller.enqueue(encoder.encode(html));
      };

      try {
        const handle = await runRender(root, options, flush, /*awaitSuspense*/ false);
        flush(buildStateScript(handle, options?.nonce, /*mergeExisting*/ true));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Public renderToString — buffered delivery.
// ---------------------------------------------------------------------------

export async function renderToString(root: JSXElement | (() => JSXElement | null), options?: RenderToStringOptions): Promise<RenderResult> {
  const chunks: string[] = [];
  const assetLinks: string[] = [];
  const flush = (s: string) => {
    if (s) chunks.push(s);
  };

  const handle = await runRender(root, options, flush, /*awaitSuspense*/ true, assetLinks);

  const html = chunks.join('');
  const stateScript = buildStateScript(handle, options?.nonce, /*mergeExisting*/ false);
  // headHtml carries shell head tags (title/meta) plus any per-lazy-boundary
  // <link> hints captured during the walk. Callers inject this into <head>
  // of the page shell.
  const headHtml = serializeHeadEntries(handle.headCollector.entries()) + assetLinks.join('');

  return { html, stateScript, headHtml };
}
