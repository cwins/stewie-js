
# [0.8.0](https://github.com/cwins/stewie-js/compare/v0.7.1...v0.8.0) (2026-04-28)


### Bug Fixes

* **@stewie-js/compiler:** type-aware auto-wrap using ts.TypeChecker ([d7201be](https://github.com/cwins/stewie-js/commit/d7201be78040caa9a022998b60d58b47474bb92f))


### Features

* **compiler:** phase 2 diagnostics — STW010, STW011, STW030 ([e7a64e5](https://github.com/cwins/stewie-js/commit/e7a64e570f8d6f173f2621928cf1bfc61bacb0b5))
* **compiler:** STW014, STW022, STW073, STW083 — standalone syntax rules ([c2b1241](https://github.com/cwins/stewie-js/commit/c2b12411df0ff6c0ae454a3d89329b2c0d110d2d))
* **compiler:** STW040, STW042, STW052 — scope/lifecycle rules ([85857f7](https://github.com/cwins/stewie-js/commit/85857f7af93bfaacbd0d958b7c8bac599dab36b3))
* **core:** reshape resource into defineResource + useResource (STW006) ([1894389](https://github.com/cwins/stewie-js/commit/1894389a10f3cdb04fe4908fe94cc23b856ed808))
* **core:** ship defineAction + useAction action primitive (STW005) ([5444adc](https://github.com/cwins/stewie-js/commit/5444adcbfb7b5ed4b7acdc06b405ada52d58631d))
* **diagnostics:** phase 1 slice — shared Diagnostic type + STW codes ([2975d81](https://github.com/cwins/stewie-js/commit/2975d8175f36f48ef55e1cafc9e07ec3de2dc4cb))

# [0.7.0](https://github.com/cwins/stewie-js/compare/v0.6.0...v0.7.0) (2026-04-10)

# [0.6.0](https://github.com/cwins/stewie-js/compare/v0.5.0...v0.6.0) (2026-04-07)

# [0.5.0](https://github.com/cwins/stewie-js/compare/v0.4.0...v0.5.0) (2026-04-03)


### Bug Fixes

* **compiler:** stop stringifying opaque JSX expression children as text ([04fdc37](https://github.com/cwins/stewie-js/commit/04fdc376f0cf6bfe55c18f1507566820cb55d637))

# [0.4.0](https://github.com/cwins/stewie-js/compare/v0.3.0...v0.4.0) (2026-03-31)


### Bug Fixes

* **@stewie/compiler:** don't transform JSX inside render-prop functions ([cbab350](https://github.com/cwins/stewie-js/commit/cbab35091fe82eb304e90984e234e452260ac263))

# [0.3.0](https://github.com/cwins/stewie-js/compare/v0.2.0...v0.3.0) (2026-03-30)


### Bug Fixes

* resolve hydration mismatch and Loading… stall from jsxToDom + lazy() ([6231b07](https://github.com/cwins/stewie-js/commit/6231b071b3c6b3bb02ea432560e723fef10d13d7))


### Features

* **@stewie-js/compiler:** fine-grained reactive DOM output ([776f5b5](https://github.com/cwins/stewie-js/commit/776f5b5cac308a600323dbd63c1a09b336a201d3))

# [0.2.0](https://github.com/cwins/stewie-js/compare/1f840e4227c23c07481870bdd20d9a719dd8ebee...v0.2.0) (2026-03-28)


### Bug Fixes

* **compiler:** correct $prop two-way binding for select and checkbox ([02b07eb](https://github.com/cwins/stewie-js/commit/02b07eb01a79851166b5dcabcb3a0a74bb9fcbb7))
* **compiler:** effect import injection checks for effect specifically, not any core import ([2caa44e](https://github.com/cwins/stewie-js/commit/2caa44eeea1cd5d5150394987f30caec8dedaf50))
* exclude test files from compiled dist output ([0defbef](https://github.com/cwins/stewie-js/commit/0defbefed003f51971eeec69471a5d1e98cd86a9))


### Features

* **@stewie/compiler:** JSX-to-DOM transformation — native HTML JSX compiles to direct DOM ops ([4727917](https://github.com/cwins/stewie-js/commit/47279178ac8c1ee18b0d7a8def1ad941a8268fd4))
* **@stewie/compiler:** TSX to fine-grained reactive output, $prop transform, validation ([4def7f6](https://github.com/cwins/stewie-js/commit/4def7f697715410c690a9223c29d5e9c8bdbab41))
* **compiler:** auto-detect signal reads in JSX and wrap in arrow functions ([08419f6](https://github.com/cwins/stewie-js/commit/08419f603fcbcdb00e37cd1197645abf8020e77a))
* monorepo foundation — pnpm workspaces, TypeScript, Vitest ([1f840e4](https://github.com/cwins/stewie-js/commit/1f840e4227c23c07481870bdd20d9a719dd8ebee))
