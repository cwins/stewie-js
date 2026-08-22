# [0.10.0](https://github.com/cwins/stewie-js/compare/v0.9.0...v0.10.0) (2026-08-05)


### Bug Fixes

* **compiler:** don't stringify JSX-returning helper calls in native elements ([dfee22a](https://github.com/cwins/stewie-js/commit/dfee22a1fda5ac68b13d82a9783e9abc48282537))
* **core:** point diagnostic docs links at the live site; add reference page ([089bd97](https://github.com/cwins/stewie-js/commit/089bd978eca72bb42b701177158f648012b870d6)), closes [.../reference/diagnostics#stwNNN](https://github.com/.../reference/diagnostics/issues/stwNNN)
* **core:** unkeyed resources bypass the DataRegistry (STW063) ([c4c2803](https://github.com/cwins/stewie-js/commit/c4c2803344726b65452c41b002caf17532b6a276))


### Features

* **compiler:** STW020/STW021 — eager signal read in Show when / For each ([45c091d](https://github.com/cwins/stewie-js/commit/45c091dc18d82c0a40e90be69ff21b7611d9fcb7))
* **core:** add Reactive<T> type for reactive props ([0951331](https://github.com/cwins/stewie-js/commit/09513315e5689d426625b8b89ac2f3bda7749912))
* STW043 (write in computed), STW093 (unknown $prop), STW050 (no provider) ([e7c9f00](https://github.com/cwins/stewie-js/commit/e7c9f0000f7162c430cb84c064ac8b7453696c5f))
* STW090/091 ($prop target), STW100 (mount on server), STW041 (onCleanup) ([4568c00](https://github.com/cwins/stewie-js/commit/4568c00954c01f35b0b907d2be976e705c42c760))

# [0.9.0](https://github.com/cwins/stewie-js/compare/v0.8.0...v0.9.0) (2026-06-15)


### Bug Fixes

* **compiler,vite:** JSX-in-JSX detection through transparent expression nodes; oxc config for Vite 8+ ([859612b](https://github.com/cwins/stewie-js/commit/859612b2f6998c7c34ffcde9b33b8a233b9bf7f2))
* **compiler:** drop enclosed auto-wrap candidates so nested wraps don't corrupt JSX ([70c7b6f](https://github.com/cwins/stewie-js/commit/70c7b6f4a14464c069088fb00d2a2b799b9bb19c))
* **core:** preserve SSR DOM through lazy() factory resolution on hydration ([b26a7c5](https://github.com/cwins/stewie-js/commit/b26a7c59c80be49567212de79fe56acad5605864))
* **router:** query-only navigation no longer re-mounts the matched route ([1f8e476](https://github.com/cwins/stewie-js/commit/1f8e4762b7ebedb19f9349b823c1204e95d90f9c))
* **router:** setQuery never runs guards or loaders ([96046a0](https://github.com/cwins/stewie-js/commit/96046a0ea7fd8162e8b5d2c61daa414bc30b4ff0))
* **router:** setQuery re-runs loaders by default; opt out for live-search ([d3d32b5](https://github.com/cwins/stewie-js/commit/d3d32b5980844d76a687aaabc9b0063593eda1ee))
* **server:** clear typecheck errors in test files ([712828d](https://github.com/cwins/stewie-js/commit/712828d8e55830004c3169f603383e5935897e8a))


### Features

* **@stewie-js/adapter-cloudflare:** Cloudflare Workers Module Worker adapter ([c8c0449](https://github.com/cwins/stewie-js/commit/c8c04496ee6c27d42c90b5455137f6e7d1c10921))
* **@stewie-js/core:** DataRegistry SPI + useResource integration ([c818279](https://github.com/cwins/stewie-js/commit/c81827981b91a35e7cedb95735a963ca46de8596))
* **@stewie-js/core:** gate lazy() resolution on CSS load ([22ca497](https://github.com/cwins/stewie-js/commit/22ca497b35452069a03a23de406fb044caee8edb))
* **@stewie-js/core:** streaming-mode Suspense hydration ([e332dc1](https://github.com/cwins/stewie-js/commit/e332dc131f0c4a84feb1f929e6f49f5fcf06647f))
* **@stewie-js/router:** nested layout routes via <Outlet /> ([55f81c5](https://github.com/cwins/stewie-js/commit/55f81c5643db3f53caa56d33cfa6ec78a792e754))
* **@stewie-js/router:** typed route definitions via createRoute() ([1762a80](https://github.com/cwins/stewie-js/commit/1762a8098641ff56d807c3ec2683ea72823d6975))
* **@stewie-js/router:** typed route params and query via RouteDefinition ([c68c119](https://github.com/cwins/stewie-js/commit/c68c119882b1fa5aeb032d9f76802157db81fa9a))
* **@stewie-js/server:** emit __STEWIE_MANIFEST__ with rendered lazy ids ([1faed67](https://github.com/cwins/stewie-js/commit/1faed67928cea5b59398f199146cd1807e1202b5))
* **@stewie-js/server:** emit modulepreload for lazy boundary JS chunks ([ecc218c](https://github.com/cwins/stewie-js/commit/ecc218c51256144be983239f86179ffd77b6a33e))
* **compiler:** extend autowrap to plain accessor reads, remove STW030 ([f083f22](https://github.com/cwins/stewie-js/commit/f083f222cdabc5d72f9e66366abbdf2eda080dc5))
* **core,server:** head/metadata primitives — useTitle, useMeta, <Head> ([c60860b](https://github.com/cwins/stewie-js/commit/c60860ba7dd34e3a9d9a1edee097a2d2916c209f))
* **core:** JSXChild allows nested arrays, undefined, and boolean ([9c1111c](https://github.com/cwins/stewie-js/commit/9c1111c91e0ef4c22e2811ed987b8b3076bf8e46))
* **router:** hover/focus prefetch on <Link>; lazy().preload() entry point ([59e2fa6](https://github.com/cwins/stewie-js/commit/59e2fa64620d242a1f347aba5bd3afd73195f2c7))
* **router:** View Transitions + scroll restoration coherence ([47d21e8](https://github.com/cwins/stewie-js/commit/47d21e826ec73ba9afe4641c290f95492e7aca31))
* SSR replay via DataRegistry + Suspense hydration cursor ([bc737c1](https://github.com/cwins/stewie-js/commit/bc737c1d52b61a623f08d04267a5f5c4410160c3))
* **vite,server,core:** progressive asset streaming via Vite ssr-manifest (Phase 1) ([76d6626](https://github.com/cwins/stewie-js/commit/76d6626b50004164bfe04144b7bbd0e10a85cbb3))
* **work-queue:** exercise router's View Transition types via transitions.css ([3271aff](https://github.com/cwins/stewie-js/commit/3271aff2c72ecb0ff3c3ec19654bc2f647ae3abe))

# [0.8.0](https://github.com/cwins/stewie-js/compare/v0.7.1...v0.8.0) (2026-04-28)


### Bug Fixes

* **@stewie-js/router:** hydration state bridge and Link destructuring cleanup ([4ef9735](https://github.com/cwins/stewie-js/commit/4ef9735af3397f90f9b5aa5c8c412edc5810b153))
* **@stewie-js/router:** small fixes for navigation status and link props ([7059d53](https://github.com/cwins/stewie-js/commit/7059d53caee4d1ba640721318b3b3aa60ea99e55))


### Features

* **@stewie-js/core:** add unshipped action() prototype ([52b17a8](https://github.com/cwins/stewie-js/commit/52b17a8fd7dc81cde779336665fa8341ec70c9b7))
* **compiler:** phase 2 diagnostics — STW010, STW011, STW030 ([e7a64e5](https://github.com/cwins/stewie-js/commit/e7a64e570f8d6f173f2621928cf1bfc61bacb0b5))
* **compiler:** STW014, STW022, STW073, STW083 — standalone syntax rules ([c2b1241](https://github.com/cwins/stewie-js/commit/c2b12411df0ff6c0ae454a3d89329b2c0d110d2d))
* **compiler:** STW040, STW042, STW052 — scope/lifecycle rules ([85857f7](https://github.com/cwins/stewie-js/commit/85857f7af93bfaacbd0d958b7c8bac599dab36b3))
* **core:** add lastRun status signal to Action ([497e2c0](https://github.com/cwins/stewie-js/commit/497e2c0eddab5f80121202dea1a4699824cdf72a))
* **core:** reshape resource into defineResource + useResource (STW006) ([1894389](https://github.com/cwins/stewie-js/commit/1894389a10f3cdb04fe4908fe94cc23b856ed808))
* **core:** ship defineAction + useAction action primitive (STW005) ([5444adc](https://github.com/cwins/stewie-js/commit/5444adcbfb7b5ed4b7acdc06b405ada52d58631d))
* **core:** zero-arg defineAction overload + conditional run() signature ([72ff58d](https://github.com/cwins/stewie-js/commit/72ff58deca68bf836432bc1fb815e23b95402bb6))
* **diagnostics:** phase 1 slice — shared Diagnostic type + STW codes ([2975d81](https://github.com/cwins/stewie-js/commit/2975d8175f36f48ef55e1cafc9e07ec3de2dc4cb))
* **examples:** add Work Queue canonical reference app (Phase 1) ([771457d](https://github.com/cwins/stewie-js/commit/771457da312cd49ed411452117ff6186d33947dc))

## [0.7.1](https://github.com/cwins/stewie-js/compare/v0.7.0...v0.7.1) (2026-04-12)


### Bug Fixes

* **@stewie-js/compiler:** type-aware auto-wrap using ts.TypeChecker ([d7201be](https://github.com/cwins/stewie-js/commit/d7201be78040caa9a022998b60d58b47474bb92f))
* **conformance:** resolve vite binary from packages/vite/node_modules ([cae04c1](https://github.com/cwins/stewie-js/commit/cae04c12f2608fae476b724f3f4e4b670e021886))


### Features

* **create-stewie:** add vitest run and vite build conformance layers ([d081e86](https://github.com/cwins/stewie-js/commit/d081e86c9add707a480dae505dd82d7af9a87c0b))

# [0.7.0](https://github.com/cwins/stewie-js/compare/v0.6.0...v0.7.0) (2026-04-10)


### Features

* **@stewie-js/core:** add _appMounted flag to suppress post-mount scope warning ([be70f81](https://github.com/cwins/stewie-js/commit/be70f81cb282e10792bbed345f3b6a75641a98a3))
* **@stewie-js/router-spi:** expand SPI with NavigationPhase, status, dismiss, preload ([05f2867](https://github.com/cwins/stewie-js/commit/05f2867042c2ee761f238a7aaaf4d6e9a026acc7))
* devtools causality + SSR anchor consistency ([9deb642](https://github.com/cwins/stewie-js/commit/9deb642697ecfca7f7e6590a4953e5e4a1f190f1))


### Performance Improvements

* **@stewie-js/core:** fold Signal children into parent effect in dom-renderer ([3310a61](https://github.com/cwins/stewie-js/commit/3310a618d19935d18f4efddd9a1cc84dd02f00c4))

# [0.6.0](https://github.com/cwins/stewie-js/compare/v0.5.0...v0.6.0) (2026-04-07)


### Bug Fixes

* **server:** extract shared serializer; fix renderToStream anchor/attr divergences ([6fd1875](https://github.com/cwins/stewie-js/commit/6fd187556c1135e8cb86ea05ec0fc9b265f33504))


### Features

* **@stewie-js/devtools:** signal graph tab with live dependency visualization ([5e9c6bf](https://github.com/cwins/stewie-js/commit/5e9c6bfc7a76fb9a508b7415a6db53ff091bc9ff))
* **core:** add getOwner() and runInOwner() for async ownership ([e3ca351](https://github.com/cwins/stewie-js/commit/e3ca351cf73b356d325d9845442c9cd5069f4bcc))
* **core:** add onCleanup() and AbortSignal support to resource() ([fb07c6b](https://github.com/cwins/stewie-js/commit/fb07c6b06e87a801fdbeae69261b3ebe35f5b2b9))
* **devtools,core:** signal labels + causality attribution in Renders tab ([0e0969d](https://github.com/cwins/stewie-js/commit/0e0969ded94c5b07b09c5610c6e68d82c2202532))
* **router:** createSsrRouter, RedirectError — SSR route guards and data loading ([41b674e](https://github.com/cwins/stewie-js/commit/41b674ea0bf6e4f18b6c8075124cb5a9b6cc4497))

# [0.5.0](https://github.com/cwins/stewie-js/compare/v0.4.0...v0.5.0) (2026-04-03)


### Bug Fixes

* **compiler:** stop stringifying opaque JSX expression children as text ([04fdc37](https://github.com/cwins/stewie-js/commit/04fdc376f0cf6bfe55c18f1507566820cb55d637))
* **core:** keyed For — update item binding on stable-key reconciliation ([d129ab8](https://github.com/cwins/stewie-js/commit/d129ab84c68775638dc01c93b9997032f001840f))
* **core:** rename For prop key→by, fix store double-proxy, remove stableList ([614216b](https://github.com/cwins/stewie-js/commit/614216bcdcc2ec3d2d0a5d9eef7a0c66343d4ca2))


### Features

* **core:** add stableList() for reference-stable derived arrays ([29c994f](https://github.com/cwins/stewie-js/commit/29c994f516cbb1a86bfd9122d8cf4fa946d2dcad))

# [0.4.0](https://github.com/cwins/stewie-js/compare/v0.3.0...v0.4.0) (2026-03-31)


### Bug Fixes

* **@stewie/compiler:** don't transform JSX inside render-prop functions ([cbab350](https://github.com/cwins/stewie-js/commit/cbab35091fe82eb304e90984e234e452260ac263))


### Performance Improvements

* WeakMap proxy caching for store + precompile route patterns ([2f72185](https://github.com/cwins/stewie-js/commit/2f7218599ef4cf982ceaa7192c40b765f117b4d1))

# [0.3.0](https://github.com/cwins/stewie-js/compare/v0.2.0...v0.3.0) (2026-03-30)


### Bug Fixes

* **create-stewie:** add dev/prod branching to Bun SSR server template ([12f949b](https://github.com/cwins/stewie-js/commit/12f949bfc42628883cda5e07834e3f4221bb6385))
* resolve hydration mismatch and Loading… stall from jsxToDom + lazy() ([6231b07](https://github.com/cwins/stewie-js/commit/6231b071b3c6b3bb02ea432560e723fef10d13d7))


### Features

* **@stewie-js/compiler:** fine-grained reactive DOM output ([776f5b5](https://github.com/cwins/stewie-js/commit/776f5b5cac308a600323dbd63c1a09b336a201d3))
* **@stewie-js/core:** resource() primitive with Suspense integration ([8f52970](https://github.com/cwins/stewie-js/commit/8f52970663d26370786e8ff1b88487464e7537d6))
* **core:** implement true DOM-reuse hydration via HydrationCursor ([b33cfe2](https://github.com/cwins/stewie-js/commit/b33cfe2881a8683d2c28cc6ed2264ae3f45e8cdb))
* **create-stewie:** showcase resource(), batch, Switch/Match; add conformance tests ([c0d74d5](https://github.com/cwins/stewie-js/commit/c0d74d520a92cc15024f16bcca751e196bd8bcbe))
* **router:** run guards and loaders on initial render and back/forward ([51ba9ab](https://github.com/cwins/stewie-js/commit/51ba9abdb06ca632ae49d386f1a335f42f80e4c0))

# [0.2.0](https://github.com/cwins/stewie-js/compare/1f840e4227c23c07481870bdd20d9a719dd8ebee...v0.2.0) (2026-03-28)


### Bug Fixes

* **@stewie/core, @stewie/server:** async-safe context via Context.Provider and snapshot threading ([8fff812](https://github.com/cwins/stewie-js/commit/8fff812d644b3d9b8026ce6b8fc5d2e6eacdf6d5))
* **@stewie/core, @stewie/server:** isolate reactive module-level state per SSR render ([5c2f1dc](https://github.com/cwins/stewie-js/commit/5c2f1dca38ab3e83ff49cb5d468999ad1cfcdd26))
* **@stewie/router:** functional Router/Route/Link with reactive navigation ([0d1362a](https://github.com/cwins/stewie-js/commit/0d1362acfa1e6442eecbf0b4410d77d4d8d124c9))
* **@stewie/vite:** use @stewie/core as jsxImportSource for all builds ([aea712f](https://github.com/cwins/stewie-js/commit/aea712fc77e6b609486bec9e7d335dac226ea547))
* address second audit findings — typecheck, router teardown, README, ROADMAP ([6a320cd](https://github.com/cwins/stewie-js/commit/6a320cd56ab95086d23ed21280d61dc3c9bcddb4))
* apply review findings — correctness, security, and API improvements ([6758341](https://github.com/cwins/stewie-js/commit/675834149ab4e98a14980b8adf70cfaeba6a3c15))
* **compiler:** correct $prop two-way binding for select and checkbox ([02b07eb](https://github.com/cwins/stewie-js/commit/02b07eb01a79851166b5dcabcb3a0a74bb9fcbb7))
* **compiler:** effect import injection checks for effect specifically, not any core import ([2caa44e](https://github.com/cwins/stewie-js/commit/2caa44eeea1cd5d5150394987f30caec8dedaf50))
* **core:** guard process.env access in hydrate.ts for WinterCG compat ([812980e](https://github.com/cwins/stewie-js/commit/812980ee125013fd669f457e2eca55a47df1321f))
* **create-stewie:** add @stewie-js/devtools to scaffold devDependencies ([d080750](https://github.com/cwins/stewie-js/commit/d08075093a362245afc9600e8c1e2096f83ece91))
* **create-stewie:** Router must have only Route elements as direct children ([4c6a7aa](https://github.com/cwins/stewie-js/commit/4c6a7aad6ac645165da0726b67856b35040a846f))
* **create-stewie:** use mount() + JSX syntax in generated templates ([882a90a](https://github.com/cwins/stewie-js/commit/882a90acf9711900018b30dca9f9187ef51d28e4))
* **devtools:** longer, more visible render highlight flash ([69b5d5a](https://github.com/cwins/stewie-js/commit/69b5d5acffdbaba787618750a509119b49414887))
* **devtools:** Renders/Stores/Routes tab bugs ([8bf10ff](https://github.com/cwins/stewie-js/commit/8bf10ffa54bb6d5381dc1ffac3f87a040f91b868))
* exclude test files from compiled dist output ([0defbef](https://github.com/cwins/stewie-js/commit/0defbefed003f51971eeec69471a5d1e98cd86a9))
* keyed For diffing and router listener teardown ([2c07d56](https://github.com/cwins/stewie-js/commit/2c07d56c74b9e5840ffac794c8560f725360122c))
* **lint:** resolve 2 pre-existing lint warnings ([9aa83bc](https://github.com/cwins/stewie-js/commit/9aa83bc701f81cf0a8acc8783a91101b4c69e02b))
* medium-priority improvements to adapter-node and public API ([9ec14d8](https://github.com/cwins/stewie-js/commit/9ec14d868ad167f29977d207a42138b40e647d9f))
* resolve all pnpm typecheck failures ([1da2a38](https://github.com/cwins/stewie-js/commit/1da2a3885941cdbdd4dddcfe4f3d86f62accbab0))
* three high-impact improvements to testing and streaming ([ae92fcc](https://github.com/cwins/stewie-js/commit/ae92fcc79d75be57942ea3d583826f493f9bdf11)), closes [hi#impact](https://github.com/hi/issues/impact)


### Features

* **@stewie-js/devtools:** browser overlay devtools panel ([58d06a6](https://github.com/cwins/stewie-js/commit/58d06a628518c852f432322cf6425e53a49d2c38))
* **@stewie/adapter-bun:** error handling and port/hostname options ([600ec71](https://github.com/cwins/stewie-js/commit/600ec71790cee46c2b44fc0d457fa580f7e96dc0))
* **@stewie/adapter-node, @stewie/adapter-bun:** Node.js and Bun HTTP adapters ([52ef091](https://github.com/cwins/stewie-js/commit/52ef091bf17b73e0978fac326a45da913d8a85f4))
* **@stewie/compiler:** JSX-to-DOM transformation — native HTML JSX compiles to direct DOM ops ([4727917](https://github.com/cwins/stewie-js/commit/47279178ac8c1ee18b0d7a8def1ad941a8268fd4))
* **@stewie/compiler:** TSX to fine-grained reactive output, $prop transform, validation ([4def7f6](https://github.com/cwins/stewie-js/commit/4def7f697715410c690a9223c29d5e9c8bdbab41))
* **@stewie/core, @stewie/vite:** DOM JSX runtime — JSX compiles to real DOM ops ([ab8b6a8](https://github.com/cwins/stewie-js/commit/ab8b6a887ea2d336ff195104befb0cbd4245f92f))
* **@stewie/core:** client-side DOM renderer with reactive subscriptions ([326fa5f](https://github.com/cwins/stewie-js/commit/326fa5f39e151177b76562c58b21bab69605f25c))
* **@stewie/core:** context, JSX runtime, built-in control flow components ([b55dee4](https://github.com/cwins/stewie-js/commit/b55dee49600f23e6fda894c548cf09ba091bf847))
* **@stewie/core:** DOM JSX runtime, hydration client, and build fix ([78351d5](https://github.com/cwins/stewie-js/commit/78351d5d901def42480549bcfa50d6c2d9f37463))
* **@stewie/core:** hydration client — reads __STEWIE_STATE__ and mounts with context ([fedea4e](https://github.com/cwins/stewie-js/commit/fedea4ea349a8f5177147843b4f72923b256c822))
* **@stewie/core:** hydration mismatch detection in dev mode ([7a0d90d](https://github.com/cwins/stewie-js/commit/7a0d90dfb0bc8b8b6f5e2fe55bfa75630e00d467))
* **@stewie/core:** signal, computed, effect, store primitives ([0966b06](https://github.com/cwins/stewie-js/commit/0966b064cfe8eba7ca51a2a8572b4fece1fa9cca))
* **@stewie/router-spi, @stewie/router:** reactive URL store, declarative routing, SPI ([391b3f4](https://github.com/cwins/stewie-js/commit/391b3f455ab2dcf3d9712915cad465407b99c890))
* **@stewie/router:** View Transitions API and Navigation API support ([6a4609c](https://github.com/cwins/stewie-js/commit/6a4609c9e45776062bb439e5935ed5d024aa6935))
* **@stewie/server:** renderToString, renderToStream, hydration registry ([ebd0ffa](https://github.com/cwins/stewie-js/commit/ebd0ffa9290055539402274889d6e255ddda84ae))
* **@stewie/testing:** mount, query, signal/store assertions, SSR test utilities ([09d1815](https://github.com/cwins/stewie-js/commit/09d1815ea62f28085af818d91cfe29d2b4295998))
* **@stewie/vite:** expose jsxToDom option in StewiePluginOptions ([fd7133f](https://github.com/cwins/stewie-js/commit/fd7133f85fec50547b23afaa91feb6f72ad54d92))
* **@stewie/vite:** Vite plugin wrapping @stewie/compiler with HMR support ([12ddaab](https://github.com/cwins/stewie-js/commit/12ddaab286ecd7fa215be1b85f3d0f77b364bf37))
* **compiler:** auto-detect signal reads in JSX and wrap in arrow functions ([08419f6](https://github.com/cwins/stewie-js/commit/08419f603fcbcdb00e37cd1197645abf8020e77a))
* convert examples to JSX, fix esbuild JSX runtime routing ([c2775b5](https://github.com/cwins/stewie-js/commit/c2775b5d95ca35078514dff779495f13fbb0e182))
* **core:** add signal.peek() — read without subscribing ([88b38ef](https://github.com/cwins/stewie-js/commit/88b38ef2ee86ef2cac6b2d49cb421a086edce74a))
* **core:** createRoot() ownership — track and dispose component effects on unmount ([fa3e220](https://github.com/cwins/stewie-js/commit/fa3e220e9f2f9b8cb2737770e775996c3d8dc912))
* **create-stewie:** project scaffolding CLI ([0401162](https://github.com/cwins/stewie-js/commit/04011622e22eb8ad396036c0bbfce795b224032b))
* **create-stewie:** richer scaffold with multi-route structure and lower-snake-case filenames ([8393aca](https://github.com/cwins/stewie-js/commit/8393aca58af1803ed1a58db544a7689d9d481fad))
* **create-stewie:** showcase new features in scaffolded templates ([b2b1b66](https://github.com/cwins/stewie-js/commit/b2b1b66f6b4dd1dc5bbf43061c1723ee22fdecd2))
* **examples/basic-ssr:** wire up Vite dev server with SSR + client hydration ([8a72eab](https://github.com/cwins/stewie-js/commit/8a72eab07e22095a691ee2b62b241f8e77ca2530))
* **examples:** ssr-and-routing TODO app + framework hydration fixes ([57267dc](https://github.com/cwins/stewie-js/commit/57267dc03463a74a4cc08c79ced06e70c105ca31))
* monorepo foundation — pnpm workspaces, TypeScript, Vitest ([1f840e4](https://github.com/cwins/stewie-js/commit/1f840e4227c23c07481870bdd20d9a719dd8ebee))
* **router,core:** lazy components, route guards, and route data loading ([49fb85a](https://github.com/cwins/stewie-js/commit/49fb85a17aa81e3aeb83d7be42c13519c58cc6af))


### Performance Improvements

* **core:** LIS-based keyed For reconciliation; add js-framework-benchmark ([aec7f40](https://github.com/cwins/stewie-js/commit/aec7f409b8127ca543f5cef397982edd787efe10))
