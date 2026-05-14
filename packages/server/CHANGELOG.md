
# [0.8.0](https://github.com/cwins/stewie-js/compare/v0.7.1...v0.8.0) (2026-04-28)

# [0.7.0](https://github.com/cwins/stewie-js/compare/v0.6.0...v0.7.0) (2026-04-10)


### Features

* devtools causality + SSR anchor consistency ([9deb642](https://github.com/cwins/stewie-js/commit/9deb642697ecfca7f7e6590a4953e5e4a1f190f1))

# [0.6.0](https://github.com/cwins/stewie-js/compare/v0.5.0...v0.6.0) (2026-04-07)


### Bug Fixes

* **server:** extract shared serializer; fix renderToStream anchor/attr divergences ([6fd1875](https://github.com/cwins/stewie-js/commit/6fd187556c1135e8cb86ea05ec0fc9b265f33504))

# [0.5.0](https://github.com/cwins/stewie-js/compare/v0.4.0...v0.5.0) (2026-04-03)


### Bug Fixes

* **core:** keyed For — update item binding on stable-key reconciliation ([d129ab8](https://github.com/cwins/stewie-js/commit/d129ab84c68775638dc01c93b9997032f001840f))

# [0.4.0](https://github.com/cwins/stewie-js/compare/v0.3.0...v0.4.0) (2026-03-31)

# [0.3.0](https://github.com/cwins/stewie-js/compare/v0.2.0...v0.3.0) (2026-03-30)


### Bug Fixes

* resolve hydration mismatch and Loading… stall from jsxToDom + lazy() ([6231b07](https://github.com/cwins/stewie-js/commit/6231b071b3c6b3bb02ea432560e723fef10d13d7))


### Features

* **@stewie-js/core:** resource() primitive with Suspense integration ([8f52970](https://github.com/cwins/stewie-js/commit/8f52970663d26370786e8ff1b88487464e7537d6))

# [0.2.0](https://github.com/cwins/stewie-js/compare/1f840e4227c23c07481870bdd20d9a719dd8ebee...v0.2.0) (2026-03-28)


### Bug Fixes

* **@stewie/core, @stewie/server:** async-safe context via Context.Provider and snapshot threading ([8fff812](https://github.com/cwins/stewie-js/commit/8fff812d644b3d9b8026ce6b8fc5d2e6eacdf6d5))
* **@stewie/core, @stewie/server:** isolate reactive module-level state per SSR render ([5c2f1dc](https://github.com/cwins/stewie-js/commit/5c2f1dca38ab3e83ff49cb5d468999ad1cfcdd26))
* **@stewie/router:** functional Router/Route/Link with reactive navigation ([0d1362a](https://github.com/cwins/stewie-js/commit/0d1362acfa1e6442eecbf0b4410d77d4d8d124c9))
* apply review findings — correctness, security, and API improvements ([6758341](https://github.com/cwins/stewie-js/commit/675834149ab4e98a14980b8adf70cfaeba6a3c15))
* exclude test files from compiled dist output ([0defbef](https://github.com/cwins/stewie-js/commit/0defbefed003f51971eeec69471a5d1e98cd86a9))
* three high-impact improvements to testing and streaming ([ae92fcc](https://github.com/cwins/stewie-js/commit/ae92fcc79d75be57942ea3d583826f493f9bdf11)), closes [hi#impact](https://github.com/hi/issues/impact)


### Features

* **@stewie/core:** hydration client — reads __STEWIE_STATE__ and mounts with context ([fedea4e](https://github.com/cwins/stewie-js/commit/fedea4ea349a8f5177147843b4f72923b256c822))
* **@stewie/server:** renderToString, renderToStream, hydration registry ([ebd0ffa](https://github.com/cwins/stewie-js/commit/ebd0ffa9290055539402274889d6e255ddda84ae))
* convert examples to JSX, fix esbuild JSX runtime routing ([c2775b5](https://github.com/cwins/stewie-js/commit/c2775b5d95ca35078514dff779495f13fbb0e182))
* **examples/basic-ssr:** wire up Vite dev server with SSR + client hydration ([8a72eab](https://github.com/cwins/stewie-js/commit/8a72eab07e22095a691ee2b62b241f8e77ca2530))
* **examples:** ssr-and-routing TODO app + framework hydration fixes ([57267dc](https://github.com/cwins/stewie-js/commit/57267dc03463a74a4cc08c79ced06e70c105ca31))
* monorepo foundation — pnpm workspaces, TypeScript, Vitest ([1f840e4](https://github.com/cwins/stewie-js/commit/1f840e4227c23c07481870bdd20d9a719dd8ebee))
