
# [0.8.0](https://github.com/cwins/stewie-js/compare/v0.7.1...v0.8.0) (2026-04-28)


### Features

* **@stewie-js/core:** add unshipped action() prototype ([52b17a8](https://github.com/cwins/stewie-js/commit/52b17a8fd7dc81cde779336665fa8341ec70c9b7))
* **core:** add lastRun status signal to Action ([497e2c0](https://github.com/cwins/stewie-js/commit/497e2c0eddab5f80121202dea1a4699824cdf72a))
* **core:** reshape resource into defineResource + useResource (STW006) ([1894389](https://github.com/cwins/stewie-js/commit/1894389a10f3cdb04fe4908fe94cc23b856ed808))
* **core:** ship defineAction + useAction action primitive (STW005) ([5444adc](https://github.com/cwins/stewie-js/commit/5444adcbfb7b5ed4b7acdc06b405ada52d58631d))
* **core:** zero-arg defineAction overload + conditional run() signature ([72ff58d](https://github.com/cwins/stewie-js/commit/72ff58deca68bf836432bc1fb815e23b95402bb6))
* **diagnostics:** phase 1 slice — shared Diagnostic type + STW codes ([2975d81](https://github.com/cwins/stewie-js/commit/2975d8175f36f48ef55e1cafc9e07ec3de2dc4cb))

# [0.7.0](https://github.com/cwins/stewie-js/compare/v0.6.0...v0.7.0) (2026-04-10)


### Features

* **@stewie-js/core:** add _appMounted flag to suppress post-mount scope warning ([be70f81](https://github.com/cwins/stewie-js/commit/be70f81cb282e10792bbed345f3b6a75641a98a3))
* devtools causality + SSR anchor consistency ([9deb642](https://github.com/cwins/stewie-js/commit/9deb642697ecfca7f7e6590a4953e5e4a1f190f1))


### Performance Improvements

* **@stewie-js/core:** fold Signal children into parent effect in dom-renderer ([3310a61](https://github.com/cwins/stewie-js/commit/3310a618d19935d18f4efddd9a1cc84dd02f00c4))

# [0.6.0](https://github.com/cwins/stewie-js/compare/v0.5.0...v0.6.0) (2026-04-07)


### Features

* **@stewie-js/devtools:** signal graph tab with live dependency visualization ([5e9c6bf](https://github.com/cwins/stewie-js/commit/5e9c6bfc7a76fb9a508b7415a6db53ff091bc9ff))
* **core:** add getOwner() and runInOwner() for async ownership ([e3ca351](https://github.com/cwins/stewie-js/commit/e3ca351cf73b356d325d9845442c9cd5069f4bcc))
* **core:** add onCleanup() and AbortSignal support to resource() ([fb07c6b](https://github.com/cwins/stewie-js/commit/fb07c6b06e87a801fdbeae69261b3ebe35f5b2b9))
* **devtools,core:** signal labels + causality attribution in Renders tab ([0e0969d](https://github.com/cwins/stewie-js/commit/0e0969ded94c5b07b09c5610c6e68d82c2202532))

# [0.5.0](https://github.com/cwins/stewie-js/compare/v0.4.0...v0.5.0) (2026-04-03)


### Bug Fixes

* **core:** keyed For — update item binding on stable-key reconciliation ([d129ab8](https://github.com/cwins/stewie-js/commit/d129ab84c68775638dc01c93b9997032f001840f))
* **core:** rename For prop key→by, fix store double-proxy, remove stableList ([614216b](https://github.com/cwins/stewie-js/commit/614216bcdcc2ec3d2d0a5d9eef7a0c66343d4ca2))


### Features

* **core:** add stableList() for reference-stable derived arrays ([29c994f](https://github.com/cwins/stewie-js/commit/29c994f516cbb1a86bfd9122d8cf4fa946d2dcad))

# [0.4.0](https://github.com/cwins/stewie-js/compare/v0.3.0...v0.4.0) (2026-03-31)


### Performance Improvements

* WeakMap proxy caching for store + precompile route patterns ([2f72185](https://github.com/cwins/stewie-js/commit/2f7218599ef4cf982ceaa7192c40b765f117b4d1))

# [0.3.0](https://github.com/cwins/stewie-js/compare/v0.2.0...v0.3.0) (2026-03-30)


### Bug Fixes

* resolve hydration mismatch and Loading… stall from jsxToDom + lazy() ([6231b07](https://github.com/cwins/stewie-js/commit/6231b071b3c6b3bb02ea432560e723fef10d13d7))


### Features

* **@stewie-js/compiler:** fine-grained reactive DOM output ([776f5b5](https://github.com/cwins/stewie-js/commit/776f5b5cac308a600323dbd63c1a09b336a201d3))
* **@stewie-js/core:** resource() primitive with Suspense integration ([8f52970](https://github.com/cwins/stewie-js/commit/8f52970663d26370786e8ff1b88487464e7537d6))
* **core:** implement true DOM-reuse hydration via HydrationCursor ([b33cfe2](https://github.com/cwins/stewie-js/commit/b33cfe2881a8683d2c28cc6ed2264ae3f45e8cdb))

# [0.2.0](https://github.com/cwins/stewie-js/compare/1f840e4227c23c07481870bdd20d9a719dd8ebee...v0.2.0) (2026-03-28)


### Bug Fixes

* **@stewie/core, @stewie/server:** async-safe context via Context.Provider and snapshot threading ([8fff812](https://github.com/cwins/stewie-js/commit/8fff812d644b3d9b8026ce6b8fc5d2e6eacdf6d5))
* **@stewie/core, @stewie/server:** isolate reactive module-level state per SSR render ([5c2f1dc](https://github.com/cwins/stewie-js/commit/5c2f1dca38ab3e83ff49cb5d468999ad1cfcdd26))
* address second audit findings — typecheck, router teardown, README, ROADMAP ([6a320cd](https://github.com/cwins/stewie-js/commit/6a320cd56ab95086d23ed21280d61dc3c9bcddb4))
* apply review findings — correctness, security, and API improvements ([6758341](https://github.com/cwins/stewie-js/commit/675834149ab4e98a14980b8adf70cfaeba6a3c15))
* **core:** guard process.env access in hydrate.ts for WinterCG compat ([812980e](https://github.com/cwins/stewie-js/commit/812980ee125013fd669f457e2eca55a47df1321f))
* **devtools:** Renders/Stores/Routes tab bugs ([8bf10ff](https://github.com/cwins/stewie-js/commit/8bf10ffa54bb6d5381dc1ffac3f87a040f91b868))
* exclude test files from compiled dist output ([0defbef](https://github.com/cwins/stewie-js/commit/0defbefed003f51971eeec69471a5d1e98cd86a9))
* keyed For diffing and router listener teardown ([2c07d56](https://github.com/cwins/stewie-js/commit/2c07d56c74b9e5840ffac794c8560f725360122c))
* medium-priority improvements to adapter-node and public API ([9ec14d8](https://github.com/cwins/stewie-js/commit/9ec14d868ad167f29977d207a42138b40e647d9f))
* resolve all pnpm typecheck failures ([1da2a38](https://github.com/cwins/stewie-js/commit/1da2a3885941cdbdd4dddcfe4f3d86f62accbab0))


### Features

* **@stewie-js/devtools:** browser overlay devtools panel ([58d06a6](https://github.com/cwins/stewie-js/commit/58d06a628518c852f432322cf6425e53a49d2c38))
* **@stewie/compiler:** JSX-to-DOM transformation — native HTML JSX compiles to direct DOM ops ([4727917](https://github.com/cwins/stewie-js/commit/47279178ac8c1ee18b0d7a8def1ad941a8268fd4))
* **@stewie/core, @stewie/vite:** DOM JSX runtime — JSX compiles to real DOM ops ([ab8b6a8](https://github.com/cwins/stewie-js/commit/ab8b6a887ea2d336ff195104befb0cbd4245f92f))
* **@stewie/core:** client-side DOM renderer with reactive subscriptions ([326fa5f](https://github.com/cwins/stewie-js/commit/326fa5f39e151177b76562c58b21bab69605f25c))
* **@stewie/core:** context, JSX runtime, built-in control flow components ([b55dee4](https://github.com/cwins/stewie-js/commit/b55dee49600f23e6fda894c548cf09ba091bf847))
* **@stewie/core:** DOM JSX runtime, hydration client, and build fix ([78351d5](https://github.com/cwins/stewie-js/commit/78351d5d901def42480549bcfa50d6c2d9f37463))
* **@stewie/core:** hydration client — reads __STEWIE_STATE__ and mounts with context ([fedea4e](https://github.com/cwins/stewie-js/commit/fedea4ea349a8f5177147843b4f72923b256c822))
* **@stewie/core:** hydration mismatch detection in dev mode ([7a0d90d](https://github.com/cwins/stewie-js/commit/7a0d90dfb0bc8b8b6f5e2fe55bfa75630e00d467))
* **@stewie/core:** signal, computed, effect, store primitives ([0966b06](https://github.com/cwins/stewie-js/commit/0966b064cfe8eba7ca51a2a8572b4fece1fa9cca))
* convert examples to JSX, fix esbuild JSX runtime routing ([c2775b5](https://github.com/cwins/stewie-js/commit/c2775b5d95ca35078514dff779495f13fbb0e182))
* **core:** add signal.peek() — read without subscribing ([88b38ef](https://github.com/cwins/stewie-js/commit/88b38ef2ee86ef2cac6b2d49cb421a086edce74a))
* **core:** createRoot() ownership — track and dispose component effects on unmount ([fa3e220](https://github.com/cwins/stewie-js/commit/fa3e220e9f2f9b8cb2737770e775996c3d8dc912))
* **create-stewie:** showcase new features in scaffolded templates ([b2b1b66](https://github.com/cwins/stewie-js/commit/b2b1b66f6b4dd1dc5bbf43061c1723ee22fdecd2))
* **examples:** ssr-and-routing TODO app + framework hydration fixes ([57267dc](https://github.com/cwins/stewie-js/commit/57267dc03463a74a4cc08c79ced06e70c105ca31))
* monorepo foundation — pnpm workspaces, TypeScript, Vitest ([1f840e4](https://github.com/cwins/stewie-js/commit/1f840e4227c23c07481870bdd20d9a719dd8ebee))
* **router,core:** lazy components, route guards, and route data loading ([49fb85a](https://github.com/cwins/stewie-js/commit/49fb85a17aa81e3aeb83d7be42c13519c58cc6af))


### Performance Improvements

* **core:** LIS-based keyed For reconciliation; add js-framework-benchmark ([aec7f40](https://github.com/cwins/stewie-js/commit/aec7f409b8127ca543f5cef397982edd787efe10))
