# Stewie Framework -- Code Review

## Executive Summary

Stewie is an ambitious attempt at a fine-grained reactive web framework with a compiler-driven approach. The core reactivity system (`signal`, `computed`, `effect`, `batch`, `store`) is the strongest part of the codebase -- it is well-structured, has solid test coverage, and the push-pull hybrid model for `ComputedNode` with memoization is a genuinely good design choice. The context system using a synchronous provider stack is clean and correct.

However, the framework suffers from a fundamental gap between what is **described** and what is **implemented**. The stated goal is "no virtual DOM -- components subscribe directly to reactive values they read" with a "compiler that transforms JSX into direct DOM subscriptions." In practice, **none of this exists**. The JSX runtime produces inert descriptor objects (a virtual DOM in all but name). The compiler only handles `$prop` expansion and module-scope detection -- it does not transform JSX into DOM subscriptions. There is no client-side rendering engine whatsoever: no `mount()` that creates real DOM elements, no reconciler, no hydration client. The framework can only render to HTML strings on the server.

The `renderToStream` implementation is misleading -- it renders the entire tree to a string first and then enqueues it as a single chunk, providing no streaming benefit. The `@stewie/testing` package queries rendered HTML with regex, which is fragile. The router components emit synthetic tags (`__stewie_route__`, `__stewie_router__`) that no renderer understands. Several packages (`@stewie/vite`, `create-stewie`) are referenced but not reviewed here. The source map generation always produces identity maps regardless of whether the transformer changed anything, making them incorrect after any transformation.

Overall: the reactive primitives are production-quality. Everything else is scaffolding and stubs that would need substantial work before real-world use.

## Package-by-Package Analysis

### @stewie/core -- Reactivity

**Correctness: Good**

The reactive system is well-implemented:

- `SignalNode` correctly uses reference equality (`===`) to skip no-op updates (line 169 of `reactive.ts`).
- `ComputedNode` implements a push-pull hybrid: it eagerly recomputes on invalidation and only propagates if the value changed (lines 247-256). This is the correct approach for memoization.
- `EffectNode` properly manages cleanup, dependency tracking, and disposal. The `_running` guard (line 277) prevents infinite loops from effects that trigger themselves.
- `batch()` correctly supports nesting via `_batchDepth` and only flushes at the outermost level.
- Dependency tracking via scope stack is clean.

**Issues:**

1. **`signal.update()` reads without tracking** (`reactive.ts:354`): `node.write(fn(node.read()))` calls `node.read()` which pushes `this` into the current scope. If `signal.update()` is called inside an effect, the effect will subscribe to the signal it is updating. This is likely unintentional -- the update function should read the raw `_value` without tracking.

2. **Eager recomputation in `ComputedNode._invalidate()` can cause issues with batching** (`reactive.ts:247-256`): When a signal changes inside a batch, all dependent computeds immediately recompute (because `_invalidate` is called synchronously from `_notifySubscribers`). But the signal's value might change again before the batch completes. This means computeds may recompute multiple times within a single batch -- the batch only defers *effect* execution, not computed recomputation. This is correct behavior for correctness (computeds are always consistent) but hurts performance. Solid.js avoids this by marking computeds dirty and deferring recomputation to read time.

3. **`_allowReactiveCreation` is a module-level mutable boolean** (`reactive.ts:48`): This is inherently not safe for concurrent requests on the server. If two requests run interleaved and both toggle this flag, they will corrupt each other's state. The `_scopeStack` array (line 66) has the same problem.

4. **No `untrack()` utility**: Reactive frameworks universally need an `untrack()` function to read a signal without subscribing. This is missing from the public API.

5. **`_warnModuleScope` uses `_scopeStack.length === 0` as a heuristic** (`reactive.ts:55`): This means the warning fires when `signal()` is called outside any tracking scope, not specifically at module scope. A `signal()` call inside a non-tracked callback (e.g., a `setTimeout` handler inside a component) would also trigger the warning, which is a false positive.

**Test Coverage: Good**

The reactive tests are thorough and cover the key behaviors including memoization, cleanup ordering, batch nesting, and chained computeds. Missing: tests for `signal.update()` tracking behavior, tests for error handling in effect functions, tests for computed with async-like patterns.

---

### @stewie/core -- JSX Runtime & Components

**Correctness: Partial (descriptor-only)**

The JSX runtime (`jsx`, `jsxs`, `Fragment`) correctly produces element descriptor objects. However:

1. **`jsx` and `jsxs` are identical** (`jsx-runtime.ts:94-100`): `jsxs` delegates to `jsx`. In React's JSX transform, `jsxs` is used for static children (array with a known length) and can skip key validation. This distinction is pointless here since there is no reconciler, but if one is ever built, this will need to diverge.

2. **Components are pure descriptor factories** (`components.ts`): `Show`, `For`, `Switch`, `Match`, `Portal`, `ErrorBoundary`, `Suspense`, and `ClientOnly` all do the same thing: wrap their props into a descriptor via `jsx(Self as unknown as Component, ...)`. The `as unknown as Component` cast on every one (e.g., line 19) is a type-safety escape hatch that obscures errors. None of these components contain any logic -- all rendering logic lives in `@stewie/server`'s `renderNode`.

3. **`JSX.IntrinsicElements` catch-all** (`jsx-runtime.ts:144`): The `[key: string]: Record<string, unknown>` catch-all means any tag name is accepted with any props, defeating the purpose of the typed element interfaces above it. A user typing `<butto>` instead of `<button>` gets no error.

4. **Missing HTML attributes**: The attribute interfaces are incomplete. No `aria-*` attributes, no `data-*` types (though the catch-all covers them), no `tabindex`, no `draggable`, no `title`, no `role`.

**Test Coverage: Adequate but shallow**

Component tests only verify that descriptor objects are produced with the right type and props. They do not test any rendering behavior because there is no client-side renderer.

---

### @stewie/compiler

**Correctness: Partial**

The compiler has three stages: parse (TypeScript API), analyze (walk AST), validate (emit diagnostics), and transform (text-based string replacement for `$prop` bindings).

**Issues:**

1. **The compiler does NOT transform JSX into DOM subscriptions** -- contrary to the stated design goal. It only handles two things: detecting module-scope reactive calls and expanding `$prop={sig}` into `value={sig()} onInput={...}`. The output is still JSX. A real compiler-driven framework (like Svelte or Solid) would transform JSX into `document.createElement` / `element.textContent = ...` / subscription setup calls. This is the single biggest gap in the entire framework.

2. **Source maps are always identity maps** (`index.ts:56`): `generateIdentitySourceMap` maps each line to itself. After the transformer rewrites `$prop` bindings (which can change line lengths and character offsets), the source map is still an identity map of the *original* source. This means the source map is **incorrect** whenever the transformer actually changes anything. The `SourceMapEntry` infrastructure exists but is never used with actual transformation offsets.

3. **Text-based transformer is fragile** (`transformer.ts:35-86`): `findDollarPropAttr` does manual string searching with brace-depth counting. It does not handle:
   - String literals containing `{` or `}` inside the expression (e.g., `$value={getVal("{")}`).
   - Template literals with embedded expressions.
   - Comments containing braces.
   - JSX expressions containing nested JSX (which have their own `{` `}` pairs).
   This is a known limitation of text-based transformation vs. AST-based transformation.

4. **Module-scope detection misses `ts.isBlock`** (`analyzer.ts:106`): The `visitModuleScope` function treats `ts.isBlock` as a function boundary, but a bare block statement `{ signal(0) }` at the top level would incorrectly *not* be flagged. More importantly, the check traverses *up* from the call expression. If `signal()` appears inside an `if` statement at the top level (e.g., `if (cond) { signal(0) }`), the `ts.isBlock` check would stop the traversal, incorrectly treating it as non-module-scope. Top-level `if` blocks are not function boundaries.

5. **`$prop` two-way binding hardcodes `HTMLInputElement`** (`transformer.ts:113`): The generated code casts `e.target as HTMLInputElement`. This only works for `<input>`. For `<textarea>` or `<select>`, the cast is wrong (though it would still work at runtime due to duck typing). For `$checked` bindings, the value accessor should be `.checked`, not `.value`.

6. **CLI entry uses `import.meta.url.endsWith(process.argv[1])`** (`index.ts:74`): This is an unreliable way to detect direct execution. It breaks if the file path contains URL-encoded characters or if the module is loaded via a different mechanism.

7. **`isReactiveExpression` heuristic is weak** (`analyzer.ts:60-73`): A zero-argument call expression is classified as "reactive" (likely a signal read). But `Date.now()`, `Math.random()`, or any other zero-arg call would be misclassified. This could lead to false positives in analysis output.

**Test Coverage: Adequate**

Tests cover the main compiler pipeline scenarios well. Missing: tests for nested JSX in `$prop` expressions, tests for multi-line expressions, edge cases in the text-based transformer.

---

### @stewie/server

**Correctness: Mostly correct for what it does**

The `renderToString` function recursively renders JSX element descriptors to HTML strings. It correctly handles:
- HTML escaping of text content and attribute values.
- Void elements (self-closing tags).
- Boolean attributes.
- Style objects (camelCase to kebab-case).
- Event handler omission.
- All built-in control flow components (`Show`, `For`, `Switch`/`Match`, `Portal`, `ErrorBoundary`, `Suspense`, `ClientOnly`).
- Fragment unwrapping.
- Async components (via `Promise` awaiting).

**Issues:**

1. **`renderToStream` is fake streaming** (`stream.ts:5-20`): The entire tree is rendered to a string first, then the complete string is enqueued as a single chunk. This provides zero streaming benefit. A real streaming renderer would flush chunks as subtrees complete (e.g., flush the `<head>` before the `<body>` finishes rendering). This is a significant gap for the "WinterCG-compatible streaming" design goal.

2. **`Suspense` on the server catches thrown errors, not thrown promises** (`renderer.ts:168-175`): React-style Suspense works by catching thrown promises (not errors). The current implementation catches any error and renders the fallback. This means `Suspense` and `ErrorBoundary` have identical server-side behavior -- they both catch exceptions. There is no mechanism for a component to signal "I'm loading" to `Suspense`.

3. **`ReadableStream<string>` is not standard** (`stream.ts:8`): The WinterCG `ReadableStream` generic parameter should be `Uint8Array` for byte streams. A `ReadableStream<string>` requires the consumer to handle string encoding themselves. Most server frameworks expect `ReadableStream<Uint8Array>`.

4. **Hydration registry is created but never populated by components** (`renderer.ts:244-258`): The registry is created and the context is provided, but no built-in mechanism actually registers anything. The `__STEWIE_STATE__` script is always emitted with an empty `{}` unless user code explicitly calls `registry.set()`. There is no automatic serialization of signal/store values.

5. **XSS risk in hydration script** (`renderer.ts:257`): `stateJson` is the result of `JSON.stringify(Object.fromEntries(store))`. If any value in the hydration registry contains `</script>`, the JSON will break out of the script tag. The standard mitigation is to escape `</` as `<\/` in the JSON output.

6. **`provide()` with async callback** (`renderer.ts:250-252`): The `provide` function in `context.ts` is synchronous -- it pushes to the stack, calls `fn()`, then pops. But here it is called with an `async () => { html = await renderNode(...) }`. The `provide` function will pop the context from the stack as soon as the first `await` yields, meaning that any async component deeper in the tree will not have access to the `HydrationRegistryContext`. This is a **correctness bug** for any non-trivial async rendering.

7. **Numbers in text content are not escaped** (`renderer.ts:107-108`): `String(node)` is returned directly for numbers. While numbers cannot contain HTML-special characters, this is inconsistent with the string path which escapes.

8. **`className` to `class` mapping** (`renderer.ts:58`): This is done but never documented. Users might not know whether to use `class` or `className`.

**Test Coverage: Good**

The renderer tests cover the main scenarios well, including HTML escaping, void elements, control flow components, and the hydration state script. Missing: tests for async components, tests for deeply nested Suspense, tests for XSS in hydration state, tests for style object serialization.

---

### @stewie/adapter-node / @stewie/adapter-bun

**@stewie/adapter-node:**

1. **Correct basic implementation**: The `IncomingMessage` to `Request` conversion handles headers, body buffering, and method extraction properly.

2. **Missing `duplex` option for request body** (`adapter.ts:32-36`): When creating a `Request` with a body for certain methods, some environments require `duplex: 'half'`. This may cause issues in newer Node.js versions.

3. **Body is read for GET/HEAD requests** (`adapter.ts:14-18`): GET and HEAD requests should not have a body, but the adapter always reads from the stream. While it correctly passes `undefined` if no chunks are received, it still creates the async iterator, which is wasteful. More importantly, if a body *is* sent with GET, it will be passed to the `Request` constructor, which is non-standard.

4. **No error handling** (`adapter.ts:57-63`): If `app(webReq)` throws, the `ServerResponse` is never completed, leaving the connection hanging. A `try/catch` with a 500 response is needed.

5. **Response streaming is not supported**: `webResponseToNodeResponse` reads the entire response body into memory via `res.arrayBuffer()`. If the app returns a streaming `Response` (which is the whole point of `renderToStream`), the stream is fully buffered before sending.

**@stewie/adapter-bun:**

This is essentially a passthrough -- it wraps the app function into a `{ fetch }` object. Correct but trivial. No error handling, no streaming consideration.

---

### @stewie/router

**Correctness: Partially implemented**

The URL pattern matcher is solid. The location store using `@stewie/core`'s `store()` for reactive properties is a good design. The `createRouter` function properly handles navigation with history API integration.

**Issues:**

1. **Router component emits fake DOM tags** (`components.ts:15`): `Router` renders `jsx('__stewie_router__', { router, children })`. There is no renderer that understands `__stewie_router__` or `__stewie_route__`. The SSR renderer will output `<__stewie_router__>...</__stewie_router__>` as literal HTML, which is invalid. This means the `Router` and `Route` components are non-functional.

2. **`Route` component has no route matching logic** (`components.ts:23-25`): It just creates a descriptor. No code anywhere actually iterates over `Route` children, matches them against the current URL, and renders the matched component. The router is an interface without a rendering implementation.

3. **`Link` component has no client-side navigation** (`components.ts:34-42`): The comment says "onClick handler would prevent default and use router.navigate in browser" but this handler is not implemented. Clicking a `Link` will do a full page navigation.

4. **`_setAllowReactiveCreation` concurrency issue** (`location.ts:59-66`): Same as noted in `@stewie/core` -- this global flag is not safe for concurrent server requests.

5. **`navigate()` does not update `params`** (`router.ts:22-37`): When navigating, `pathname`, `query`, and `hash` are updated, but `params` is not cleared or recalculated. After navigation, `location.params` retains stale values from the previous route match.

6. **`back()` and `forward()` do not update the location store** (`router.ts:40-49`): They call `history.back()` / `history.forward()` but don't listen for `popstate` events, so the reactive location store becomes out of sync with the actual URL.

7. **No wildcard param capture**: The matcher supports `*` wildcards but does not capture the matched wildcard segments into params. A route like `/files/*` matching `/files/a/b/c` returns empty params -- the `a/b/c` part is lost.

8. **`parseQuery` does not handle repeated keys** (`location.ts:10-28`): `?a=1&a=2` results in `{ a: '2' }` (last wins). Most frameworks expose repeated keys as arrays.

**Test Coverage: Good for matcher, adequate for router**

The matcher tests are thorough. The router tests cover basic functionality. Missing: tests for the `Router`/`Route`/`Link` components, tests for `popstate` handling, tests for wildcard capture.

---

### @stewie/testing

**Correctness: Works within its limitations**

The testing package renders components via `renderToString` and then queries the resulting HTML with regex. This is fundamentally limited.

**Issues:**

1. **Regex-based HTML querying is fragile** (`queries.ts`): `extractElements` uses a regex to find opening tags and `indexOf` for closing tags. This breaks for:
   - Nested same-tag elements: `<div><div>inner</div></div>` -- the inner `</div>` matches the outer.
   - Self-closing tags with content: void elements like `<input>` have no closing tag but the regex looks for one.
   - Elements split across multiple lines with attributes containing `>`.

2. **`findByText` searches a hardcoded list of tags** (`queries.ts:117-122`): If a component renders a `<dt>`, `<dd>`, `<summary>`, `<details>`, `<figcaption>`, or any custom element, `findByText` will not find text inside them.

3. **`buildHandle.outerHTML` is incorrect** (`queries.ts:40`): It constructs `outerHTML` as `${openTag}</${tagName}>` without including `innerHTML`. The resulting `outerHTML` is always an empty element.

4. **`findByRole` does not check `type` attribute** (`queries.ts:153-176`): Looking for role `checkbox` searches `<input>` elements but does not verify `type="checkbox"`. A text input would match the `checkbox` role query.

5. **`mount()` is static** (`mount.ts`): After rendering, the HTML is frozen. There is no way to test reactive updates -- setting a signal after mount does not re-render. The `flushEffects` function is a no-op stub. This makes the testing library unable to test the core value proposition of the framework (reactivity).

6. **`assertSignal` and `assertStore` use strict equality** (`assertions.ts`): `assertStore` compares with `!==`, which means comparing objects or arrays always fails even if they are deeply equal. Should use deep equality or at least document this limitation.

**Test Coverage: Minimal**

The testing package tests mostly verify that mount works for simple cases. No tests for edge cases in HTML parsing, no tests for the role mapping accuracy, no tests for context-provided rendering.

---

### Examples

**basic-ssr:**

The SSR example (`examples/basic-ssr/src/app.ts`) demonstrates the framework's capabilities reasonably well. It uses context, `Show`, and `For`. However:

1. **No reactivity is demonstrated**: The `App` component receives a plain `AppState` object, not reactive signals/stores. It is a static render.

2. **`ThemeIndicator` calls `inject()` at render time**: This works because `provide()` wraps the rendering synchronously. But if the renderer were async (which it is), the `provide` context might not be available (as noted in the server section).

3. **`jsx(App as any, ...)`** (`app.ts:82`): The `as any` cast indicates the type system is not accommodating component prop types correctly.

**static:**

The counter and data-fetcher examples (`examples/static/`) demonstrate signal/computed/effect usage outside of rendering. They are essentially unit-testable state management utilities. Both use `_setAllowReactiveCreation(true/false)` to bypass the module-scope guard, which is awkward API ergonomics that would be confusing for end users.

---

## Cross-Cutting Issues

### 1. No Client-Side Renderer

This is the most critical gap. The framework has:
- A reactivity system (signals, stores, effects).
- A JSX runtime that produces descriptors.
- A server-side string renderer.

But it is missing:
- A client-side renderer that turns JSX descriptors into real DOM elements.
- A hydration client that picks up `__STEWIE_STATE__` and makes the server-rendered HTML interactive.
- The "compiler-driven direct DOM subscriptions" that are the framework's stated raison d'etre.

Without these, Stewie cannot render anything in a browser.

### 2. Module-Level Mutable State is Not Request-Safe

The framework uses several module-level mutable variables:
- `_scopeStack` (array) in `reactive.ts`
- `_batchDepth` (number) and `_pendingEffects` (Set) in `reactive.ts`
- `_allowReactiveCreation` (boolean) in `reactive.ts`
- `_providerStack` (Map) in `context.ts`

In a server environment handling concurrent requests (which is the stated use case), these shared mutable globals mean requests will interfere with each other. This is a **fundamental architectural problem** for SSR. Frameworks like Solid.js solve this with explicit request-scoped owner/context objects rather than module-level stacks.

### 3. `_setAllowReactiveCreation` is a Leaky Abstraction

The examples and tests all need to call `_setAllowReactiveCreation(true)` before creating signals outside a component. This internal API is exported from `@stewie/core`'s public index. It should either be:
- Handled automatically by the framework (e.g., a `createRoot()` function that sets up a scope).
- Not needed (remove the module-scope restriction for factory functions that return signals).

### 4. Type Safety Gaps

- `as unknown as Component` casts throughout `components.ts`.
- `as any` in examples and tests.
- `[key: string]: Record<string, unknown>` catch-all in `IntrinsicElements`.
- The `Signal<T>` interface is a callable function with methods attached -- this works at runtime but is hard to type correctly. The interface declares `(): T` and `set(value: T): void` but the actual implementation is a plain function with properties monkey-patched onto it.

### 5. The Compiler Does Not Fulfill Its Design Goal

The design says: "a TSX compiler transforms JSX into direct DOM subscriptions rather than VDOM diffing." The actual compiler transforms `$value={sig}` into `value={sig()} onInput={...}` and detects module-scope calls. It does not transform JSX into anything other than JSX. The heavy lifting that would make this a "compiler-driven" framework -- the part that makes it different from React -- is entirely unimplemented.

---

## Missing / Incomplete

1. **Client-side rendering engine**: No `mount()`, `hydrate()`, or DOM creation from JSX descriptors.
2. **Hydration client**: No code to read `__STEWIE_STATE__` and rehydrate.
3. **Real streaming in `renderToStream`**: Currently buffers the entire response.
4. **Compiler JSX-to-DOM transformation**: The core differentiating feature is unimplemented.
5. **`untrack()` utility**: Standard reactive primitive, missing from public API.
6. **`onMount()` / `onCleanup()` lifecycle hooks**: Referenced in design but not implemented.
7. **`createRoot()` / `runWithOwner()`**: No way to create a reactive scope outside a component.
8. **Router rendering**: `Router`/`Route` components produce descriptors no renderer understands.
9. **`Link` onClick prevention**: Client-side navigation not wired up.
10. **`popstate` listener**: Router does not respond to browser back/forward.
11. **`@stewie/vite`**: Referenced but not reviewed -- likely a thin wrapper.
12. **`create-stewie` CLI**: Referenced but not reviewed.
13. **Error boundaries on the client**: Only implemented for SSR.
14. **Suspense with async resources**: No `createResource()` or equivalent.
15. **Keyed list diffing for `For`**: The `key` prop is accepted but unused -- no reconciliation.

---

## Recommendations

### Critical

1. **Implement a client-side rendering engine**: Without this, the framework cannot run in a browser. This is the highest priority. It should take JSX descriptors and create/update real DOM elements, with fine-grained subscriptions to reactive values.

2. **Fix the `provide()` + async rendering bug** (`packages/server/src/renderer.ts:250-252`): The context stack is popped when the async callback yields, breaking context propagation for async components. Either make the context system async-aware or restructure the rendering to not rely on synchronous context during async operations.

3. **Address module-level mutable state for SSR safety** (`packages/core/src/reactive.ts`, `packages/core/src/context.ts`): Replace module-level stacks/counters with request-scoped containers. This is a fundamental architectural issue that will cause data leaks between requests.

4. **Fix the XSS vulnerability in hydration script** (`packages/server/src/renderer.ts:257`): Escape `</script>` sequences in the JSON output of `__STEWIE_STATE__`.

### High

5. **Implement the compiler's JSX-to-DOM transformation**: This is the framework's stated differentiator. Without it, Stewie is just another VDOM framework with an extra build step that does almost nothing.

6. **Implement real streaming in `renderToStream`** (`packages/server/src/stream.ts`): Flush chunks incrementally as subtrees complete.

7. **Fix `Router`/`Route` components** (`packages/router/src/components.ts`): Either implement a renderer that understands `__stewie_route__`/`__stewie_router__` tags, or change these components to evaluate routes and render the matched component directly.

8. **Fix `signal.update()` tracking** (`packages/core/src/reactive.ts:354`): Read `node._value` directly instead of `node.read()` to avoid subscribing the current scope to the signal being updated.

9. **Add `untrack()` to the public API**: Essential for avoiding unwanted subscriptions.

10. **Add error handling to `adapter-node`** (`packages/adapter-node/src/adapter.ts:58-63`): Wrap `app(webReq)` in try/catch and send a 500 response on failure.

### Medium

11. **Fix `buildHandle.outerHTML`** (`packages/testing/src/queries.ts:40`): Include `innerHTML` in the construction: `${openTag}${innerHTML}</${tagName}>`.

12. **Fix source map generation after transformation** (`packages/compiler/src/index.ts:56`): Track actual offsets during `$prop` transformation and generate correct mappings instead of identity maps.

13. **Add `popstate` event listener to the router** (`packages/router/src/router.ts`): Without it, browser back/forward breaks the reactive location state.

14. **Clear `location.params` on navigate** (`packages/router/src/router.ts:22-37`): Reset params to `{}` during navigation, or better, run route matching and update params automatically.

15. **Make `findByRole` check input types** (`packages/testing/src/queries.ts:153`): When looking for `checkbox` or `radio` roles, verify the `type` attribute matches.

16. **Add `createRoot()` to the public API**: Provide a clean way to create a reactive scope outside components, eliminating the need for `_setAllowReactiveCreation`.

### Low

17. **Improve `findByText` tag coverage** (`packages/testing/src/queries.ts:117`): Consider parsing the HTML more robustly (e.g., using a simple state machine) rather than searching a hardcoded tag list.

18. **Support repeated query parameters** (`packages/router/src/location.ts:10-28`): `?a=1&a=2` should produce `{ a: ['1', '2'] }` or at least be documented as last-wins.

19. **Document `className` vs `class` mapping** (`packages/server/src/renderer.ts:58`): Users need to know which to use.

20. **Fix `assertStore` to use deep equality** (`packages/testing/src/assertions.ts:27`): Or document that only primitive values can be compared.

21. **Remove `_setAllowReactiveCreation` from the public exports** (`packages/core/src/index.ts:14-15`): This is an internal API that should not be in the public surface.

22. **Consider `ReadableStream<Uint8Array>` for `renderToStream`** (`packages/server/src/stream.ts:8`): Most server frameworks expect byte streams, not string streams.
