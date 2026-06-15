# [0.9.0](https://github.com/cwins/stewie-js/compare/v0.8.0...v0.9.0) (2026-06-15)

# [0.8.0](https://github.com/cwins/stewie-js/compare/v0.7.1...v0.8.0) (2026-04-28)


### Features

* **core:** reshape resource into defineResource + useResource (STW006) ([1894389](https://github.com/cwins/stewie-js/commit/1894389a10f3cdb04fe4908fe94cc23b856ed808))

## [0.7.1](https://github.com/cwins/stewie-js/compare/v0.7.0...v0.7.1) (2026-04-12)


### Bug Fixes

* **conformance:** resolve vite binary from packages/vite/node_modules ([cae04c1](https://github.com/cwins/stewie-js/commit/cae04c12f2608fae476b724f3f4e4b670e021886))


### Features

* **create-stewie:** add vitest run and vite build conformance layers ([d081e86](https://github.com/cwins/stewie-js/commit/d081e86c9add707a480dae505dd82d7af9a87c0b))

# [0.7.0](https://github.com/cwins/stewie-js/compare/v0.6.0...v0.7.0) (2026-04-10)


### Features

* **@stewie-js/router-spi:** expand SPI with NavigationPhase, status, dismiss, preload ([05f2867](https://github.com/cwins/stewie-js/commit/05f2867042c2ee761f238a7aaaf4d6e9a026acc7))

# [0.6.0](https://github.com/cwins/stewie-js/compare/v0.5.0...v0.6.0) (2026-04-07)


### Features

* **core:** add onCleanup() and AbortSignal support to resource() ([fb07c6b](https://github.com/cwins/stewie-js/commit/fb07c6b06e87a801fdbeae69261b3ebe35f5b2b9))

# [0.5.0](https://github.com/cwins/stewie-js/compare/v0.4.0...v0.5.0) (2026-04-03)


### Bug Fixes

* **core:** keyed For — update item binding on stable-key reconciliation ([d129ab8](https://github.com/cwins/stewie-js/commit/d129ab84c68775638dc01c93b9997032f001840f))
* **core:** rename For prop key→by, fix store double-proxy, remove stableList ([614216b](https://github.com/cwins/stewie-js/commit/614216bcdcc2ec3d2d0a5d9eef7a0c66343d4ca2))

# [0.4.0](https://github.com/cwins/stewie-js/compare/v0.3.0...v0.4.0) (2026-03-31)

# [0.3.0](https://github.com/cwins/stewie-js/compare/v0.2.0...v0.3.0) (2026-03-30)


### Bug Fixes

* **create-stewie:** add dev/prod branching to Bun SSR server template ([12f949b](https://github.com/cwins/stewie-js/commit/12f949bfc42628883cda5e07834e3f4221bb6385))


### Features

* **create-stewie:** showcase resource(), batch, Switch/Match; add conformance tests ([c0d74d5](https://github.com/cwins/stewie-js/commit/c0d74d520a92cc15024f16bcca751e196bd8bcbe))

# [0.2.0](https://github.com/cwins/stewie-js/compare/1f840e4227c23c07481870bdd20d9a719dd8ebee...v0.2.0) (2026-03-28)


### Bug Fixes

* **create-stewie:** add @stewie-js/devtools to scaffold devDependencies ([d080750](https://github.com/cwins/stewie-js/commit/d08075093a362245afc9600e8c1e2096f83ece91))
* **create-stewie:** Router must have only Route elements as direct children ([4c6a7aa](https://github.com/cwins/stewie-js/commit/4c6a7aad6ac645165da0726b67856b35040a846f))
* **create-stewie:** use mount() + JSX syntax in generated templates ([882a90a](https://github.com/cwins/stewie-js/commit/882a90acf9711900018b30dca9f9187ef51d28e4))
* exclude test files from compiled dist output ([0defbef](https://github.com/cwins/stewie-js/commit/0defbefed003f51971eeec69471a5d1e98cd86a9))


### Features

* **create-stewie:** project scaffolding CLI ([0401162](https://github.com/cwins/stewie-js/commit/04011622e22eb8ad396036c0bbfce795b224032b))
* **create-stewie:** richer scaffold with multi-route structure and lower-snake-case filenames ([8393aca](https://github.com/cwins/stewie-js/commit/8393aca58af1803ed1a58db544a7689d9d481fad))
* **create-stewie:** showcase new features in scaffolded templates ([b2b1b66](https://github.com/cwins/stewie-js/commit/b2b1b66f6b4dd1dc5bbf43061c1723ee22fdecd2))
* monorepo foundation — pnpm workspaces, TypeScript, Vitest ([1f840e4](https://github.com/cwins/stewie-js/commit/1f840e4227c23c07481870bdd20d9a719dd8ebee))
