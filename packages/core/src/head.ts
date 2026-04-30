// head.ts — useTitle, useMeta, and <Head> primitives for @stewie-js/core
//
// Client: signal-driven DOM mutations to document.head, cleaned up on scope dispose.
// Server: registers with the SSR head context (HeadContext) so renderers can emit
//   <title> / <meta> tags in the <head> or inline <script> patches per Suspense boundary.

import { effect, onCleanup } from './reactive.js';
import type { Signal } from './reactive.js';
import { consume, createContext } from './context.js';
import { jsx } from './jsx-runtime.js';
import type { JSXElement, Component } from './jsx-runtime.js';
import { Portal } from './components.js';

// ---------------------------------------------------------------------------
// SSR head context — collected during server render
// ---------------------------------------------------------------------------

export interface HeadEntry {
  type: 'title' | 'meta';
  /** Resolved (non-reactive) title string. Only set when type === 'title'. */
  title?: string;
  /** Resolved attribute map. Only set when type === 'meta'. */
  attrs?: Record<string, string>;
}

export interface HeadCollector {
  add(entry: HeadEntry): void;
  entries(): HeadEntry[];
}

export function createHeadCollector(): HeadCollector {
  const _entries: HeadEntry[] = [];
  return {
    add(entry) {
      _entries.push(entry);
    },
    entries() {
      return _entries.slice();
    }
  };
}

export const HeadContext = createContext<HeadCollector | null>(null);

// ---------------------------------------------------------------------------
// Accessor normalisation
// ---------------------------------------------------------------------------

type StringSource = string | (() => string) | Signal<string>;

function resolveStringSource(src: StringSource): string {
  if (typeof src === 'string') return src;
  return (src as () => string)();
}

// ---------------------------------------------------------------------------
// useMeta props
// ---------------------------------------------------------------------------

export type UseMetaProps = { name: string; content: StringSource } | { property: string; content: StringSource };

// ---------------------------------------------------------------------------
// useTitle
// ---------------------------------------------------------------------------

/**
 * Reactively set `document.title`.
 *
 * Accepts a `string`, an accessor `() => string`, or a `Signal<string>`.
 * Must be called inside a component or `reactiveScope()`.
 *
 * If multiple `useTitle` calls are active, the last one to run wins —
 * matching browser semantics (one title per document). The previous title
 * is NOT restored on cleanup; restoring would require a stack and is
 * brittle in the presence of async navigation.
 *
 * On the server, the resolved title is registered with the nearest
 * `HeadContext` provider and emitted by the renderer in the `<head>` or
 * as an inline `<script>document.title = '...'</script>` patch when inside
 * a Suspense boundary.
 */
export function useTitle(value: StringSource): void {
  const collector = consume(HeadContext);

  if (typeof document !== 'undefined') {
    if (typeof value === 'string') {
      document.title = value;
    } else {
      effect(() => {
        document.title = resolveStringSource(value);
      });
    }
  } else if (collector) {
    const title = typeof value === 'string' ? value : resolveStringSource(value);
    collector.add({ type: 'title', title });
  }
}

// ---------------------------------------------------------------------------
// useMeta
// ---------------------------------------------------------------------------

/**
 * Reactively manage a `<meta>` tag in `document.head`.
 *
 * Accepts either `{ name, content }` for standard meta tags or
 * `{ property, content }` for OpenGraph tags.
 * `content` may be a `string`, an accessor `() => string`, or a `Signal<string>`.
 *
 * Must be called inside a component or `reactiveScope()`.
 *
 * Identity key is `name` or `property`. On first call, a new `<meta>` tag is
 * inserted; subsequent reactive updates change only the `content` attribute.
 * On cleanup (component unmount), the inserted tag is removed.
 *
 * On the server, a resolved snapshot is registered with `HeadContext`.
 */
export function useMeta(props: UseMetaProps): void {
  const collector = consume(HeadContext);

  if (typeof document !== 'undefined') {
    const attrKey = 'name' in props ? 'name' : 'property';
    const attrValue = props[attrKey as keyof typeof props] as string;

    let meta = document.head.querySelector(`meta[${attrKey}="${CSS.escape(attrValue)}"]`) as HTMLMetaElement | null;
    let inserted = false;

    if (!meta) {
      meta = document.createElement('meta');
      (meta as HTMLMetaElement).setAttribute(attrKey, attrValue);
      document.head.appendChild(meta as HTMLMetaElement);
      inserted = true;
    }

    const metaEl = meta as HTMLMetaElement;

    if (typeof props.content === 'string') {
      metaEl.setAttribute('content', props.content);
    } else {
      effect(() => {
        metaEl.setAttribute('content', resolveStringSource(props.content));
      });
    }

    if (inserted) {
      onCleanup(() => {
        metaEl.parentNode?.removeChild(metaEl);
      });
    }
  } else if (collector) {
    const attrKey = 'name' in props ? 'name' : 'property';
    const attrValue = props[attrKey as keyof typeof props] as string;
    const content = typeof props.content === 'string' ? props.content : resolveStringSource(props.content);
    collector.add({ type: 'meta', attrs: { [attrKey]: attrValue, content } });
  }
}

// ---------------------------------------------------------------------------
// <Head> component
// ---------------------------------------------------------------------------

/**
 * Render children into `document.head` on the client.
 * On the server, children are rendered inline (the SSR renderers emit head
 * tags from the HeadContext collector, not from the Head component's output).
 */
export interface HeadProps {
  children: JSXElement | JSXElement[];
}

export function Head(props: HeadProps): JSXElement {
  if (typeof document !== 'undefined') {
    return jsx(Portal as unknown as Component, { target: document.head, children: props.children });
  }
  return jsx(Portal as unknown as Component, { children: props.children });
}
