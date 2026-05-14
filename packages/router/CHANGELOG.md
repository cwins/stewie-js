
# [0.8.0](https://github.com/cwins/stewie-js/compare/v0.7.1...v0.8.0) (2026-04-28)


### Bug Fixes

* **@stewie-js/router:** hydration state bridge and Link destructuring cleanup ([4ef9735](https://github.com/cwins/stewie-js/commit/4ef9735af3397f90f9b5aa5c8c412edc5810b153))
* **@stewie-js/router:** small fixes for navigation status and link props ([7059d53](https://github.com/cwins/stewie-js/commit/7059d53caee4d1ba640721318b3b3aa60ea99e55))


### Features

* **examples:** add Work Queue canonical reference app (Phase 1) ([771457d](https://github.com/cwins/stewie-js/commit/771457da312cd49ed411452117ff6186d33947dc))

# [0.7.0](https://github.com/cwins/stewie-js/compare/v0.6.0...v0.7.0) (2026-04-10)


### Features

* **@stewie-js/router-spi:** expand SPI with NavigationPhase, status, dismiss, preload ([05f2867](https://github.com/cwins/stewie-js/commit/05f2867042c2ee761f238a7aaaf4d6e9a026acc7))

# [0.6.0](https://github.com/cwins/stewie-js/compare/v0.5.0...v0.6.0) (2026-04-07)


### Features

* **router:** createSsrRouter, RedirectError — SSR route guards and data loading ([41b674e](https://github.com/cwins/stewie-js/commit/41b674ea0bf6e4f18b6c8075124cb5a9b6cc4497))

# [0.5.0](https://github.com/cwins/stewie-js/compare/v0.4.0...v0.5.0) (2026-04-03)

# [0.4.0](https://github.com/cwins/stewie-js/compare/v0.3.0...v0.4.0) (2026-03-31)


### Performance Improvements

* WeakMap proxy caching for store + precompile route patterns ([2f72185](https://github.com/cwins/stewie-js/commit/2f7218599ef4cf982ceaa7192c40b765f117b4d1))

# [0.3.0](https://github.com/cwins/stewie-js/compare/v0.2.0...v0.3.0) (2026-03-30)


### Features

* **router:** run guards and loaders on initial render and back/forward ([51ba9ab](https://github.com/cwins/stewie-js/commit/51ba9abdb06ca632ae49d386f1a335f42f80e4c0))

# [0.2.0](https://github.com/cwins/stewie-js/compare/1f840e4227c23c07481870bdd20d9a719dd8ebee...v0.2.0) (2026-03-28)


### Bug Fixes

* **@stewie/router:** functional Router/Route/Link with reactive navigation ([0d1362a](https://github.com/cwins/stewie-js/commit/0d1362acfa1e6442eecbf0b4410d77d4d8d124c9))
* address second audit findings — typecheck, router teardown, README, ROADMAP ([6a320cd](https://github.com/cwins/stewie-js/commit/6a320cd56ab95086d23ed21280d61dc3c9bcddb4))
* apply review findings — correctness, security, and API improvements ([6758341](https://github.com/cwins/stewie-js/commit/675834149ab4e98a14980b8adf70cfaeba6a3c15))
* exclude test files from compiled dist output ([0defbef](https://github.com/cwins/stewie-js/commit/0defbefed003f51971eeec69471a5d1e98cd86a9))
* keyed For diffing and router listener teardown ([2c07d56](https://github.com/cwins/stewie-js/commit/2c07d56c74b9e5840ffac794c8560f725360122c))


### Features

* **@stewie/router-spi, @stewie/router:** reactive URL store, declarative routing, SPI ([391b3f4](https://github.com/cwins/stewie-js/commit/391b3f455ab2dcf3d9712915cad465407b99c890))
* **@stewie/router:** View Transitions API and Navigation API support ([6a4609c](https://github.com/cwins/stewie-js/commit/6a4609c9e45776062bb439e5935ed5d024aa6935))
* convert examples to JSX, fix esbuild JSX runtime routing ([c2775b5](https://github.com/cwins/stewie-js/commit/c2775b5d95ca35078514dff779495f13fbb0e182))
* **examples:** ssr-and-routing TODO app + framework hydration fixes ([57267dc](https://github.com/cwins/stewie-js/commit/57267dc03463a74a4cc08c79ced06e70c105ca31))
* monorepo foundation — pnpm workspaces, TypeScript, Vitest ([1f840e4](https://github.com/cwins/stewie-js/commit/1f840e4227c23c07481870bdd20d9a719dd8ebee))
* **router,core:** lazy components, route guards, and route data loading ([49fb85a](https://github.com/cwins/stewie-js/commit/49fb85a17aa81e3aeb83d7be42c13519c58cc6af))
