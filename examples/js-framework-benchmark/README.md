# Stewie — js-framework-benchmark

Implementation of the [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) for `@stewie-js/core`.

## Running locally

```bash
# From repo root
pnpm --filter stewie-js-framework-benchmark dev
# open http://localhost:8080
```

## Building

```bash
pnpm --filter stewie-js-framework-benchmark build
# output → examples/js-framework-benchmark/dist/
```

## Running with the official benchmark suite

1. Clone the benchmark runner:
   ```bash
   git clone https://github.com/krausest/js-framework-benchmark.git
   cd js-framework-benchmark
   ```

2. Copy this directory into the runner's keyed frameworks folder:
   ```bash
   cp -r /path/to/stewie/examples/js-framework-benchmark \
         frameworks/keyed/stewie
   ```

3. Install and build inside the runner:
   ```bash
   cd frameworks/keyed/stewie
   npm install   # or: pnpm install (swap workspace:* deps for published versions first)
   npm run build
   ```

4. Run the benchmark from the repo root:
   ```bash
   cd js-framework-benchmark
   npm run bench keyed/stewie
   ```

## Notes on the implementation

- **Per-row label signals**: each row stores its label as a `Signal<string>`.
  The `update` operation (every 10th row) changes only those label signals —
  only the affected `<a class="lbl">` text nodes re-run. The rest of the
  table is untouched.

- **Keyed `For`**: rows are diffed by `id`, so `swapRows` moves DOM nodes
  rather than recreating them.

- **`batch()`**: the partial update wraps all 100 label writes in `batch()`
  so effects flush together rather than one at a time.

- **Bundle size**: ~3.9 kB gzipped for the full app + framework runtime.
