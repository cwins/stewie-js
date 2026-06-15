# [0.9.0](https://github.com/cwins/stewie-js/compare/v0.8.0...v0.9.0) (2026-06-15)


### Bug Fixes

* **router:** query-only navigation no longer re-mounts the matched route ([1f8e476](https://github.com/cwins/stewie-js/commit/1f8e4762b7ebedb19f9349b823c1204e95d90f9c))
* **router:** setQuery never runs guards or loaders ([96046a0](https://github.com/cwins/stewie-js/commit/96046a0ea7fd8162e8b5d2c61daa414bc30b4ff0))
* **router:** setQuery re-runs loaders by default; opt out for live-search ([d3d32b5](https://github.com/cwins/stewie-js/commit/d3d32b5980844d76a687aaabc9b0063593eda1ee))


### Features

* **router:** View Transitions + scroll restoration coherence ([47d21e8](https://github.com/cwins/stewie-js/commit/47d21e826ec73ba9afe4641c290f95492e7aca31))

# [0.8.0](https://github.com/cwins/stewie-js/compare/v0.7.1...v0.8.0) (2026-04-28)

# [0.7.0](https://github.com/cwins/stewie-js/compare/v0.6.0...v0.7.0) (2026-04-10)


### Features

* **@stewie-js/router-spi:** expand SPI with NavigationPhase, status, dismiss, preload ([05f2867](https://github.com/cwins/stewie-js/commit/05f2867042c2ee761f238a7aaaf4d6e9a026acc7))

# [0.6.0](https://github.com/cwins/stewie-js/compare/v0.5.0...v0.6.0) (2026-04-07)

# [0.5.0](https://github.com/cwins/stewie-js/compare/v0.4.0...v0.5.0) (2026-04-03)

# [0.4.0](https://github.com/cwins/stewie-js/compare/v0.3.0...v0.4.0) (2026-03-31)

# [0.3.0](https://github.com/cwins/stewie-js/compare/v0.2.0...v0.3.0) (2026-03-30)

# [0.2.0](https://github.com/cwins/stewie-js/compare/1f840e4227c23c07481870bdd20d9a719dd8ebee...v0.2.0) (2026-03-28)


### Bug Fixes

* address second audit findings — typecheck, router teardown, README, ROADMAP ([6a320cd](https://github.com/cwins/stewie-js/commit/6a320cd56ab95086d23ed21280d61dc3c9bcddb4))
* exclude test files from compiled dist output ([0defbef](https://github.com/cwins/stewie-js/commit/0defbefed003f51971eeec69471a5d1e98cd86a9))


### Features

* **@stewie/router-spi, @stewie/router:** reactive URL store, declarative routing, SPI ([391b3f4](https://github.com/cwins/stewie-js/commit/391b3f455ab2dcf3d9712915cad465407b99c890))
* monorepo foundation — pnpm workspaces, TypeScript, Vitest ([1f840e4](https://github.com/cwins/stewie-js/commit/1f840e4227c23c07481870bdd20d9a719dd8ebee))
* **router,core:** lazy components, route guards, and route data loading ([49fb85a](https://github.com/cwins/stewie-js/commit/49fb85a17aa81e3aeb83d7be42c13519c58cc6af))
