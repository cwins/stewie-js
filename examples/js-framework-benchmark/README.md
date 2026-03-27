# Stewie — js-framework-benchmark

Implementation of the [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark) for `@stewie-js/core`.

## Running locally (without the benchmark harness)

```bash
# From the repo root
pnpm --filter stewie-js-framework-benchmark dev
# → http://localhost:8080
# Note: /css/currentStyle.css won't load (it's served by the benchmark
# runner), but all buttons and table behaviour work fine for manual testing.
```

## Running with the official benchmark suite

### Prerequisites

- Node.js 20+, npm 10+
- Chrome installed (chromedriver version is pinned to match — see benchmark repo)

### Steps

**1. Clone the benchmark runner**

```bash
git clone https://github.com/krausest/js-framework-benchmark.git
cd js-framework-benchmark
npm ci
npm run install-local   # installs the local static server + webdriver-ts
```

**2. Copy this directory into the runner**

```bash
cp -r /path/to/stewie/examples/js-framework-benchmark \
      frameworks/keyed/stewie
```

**3. Swap workspace deps for published versions**

Edit `frameworks/keyed/stewie/package.json` — change:
```json
"@stewie-js/core": "workspace:*"
```
to the published version (exact, no ranges):
```json
"@stewie-js/core": "0.1.0"
```

**4. Build the framework inside the runner**

```bash
cd frameworks/keyed/stewie
npm install
npm run build-prod
cd ../../..
```

**5. Validate the implementation**

```bash
# Check it builds and keyed reconciliation works
npm run rebuild-ci keyed/stewie
npm run isKeyed keyed/stewie
```

**6. Run the benchmark** (Stewie + vanillajs as baseline)

```bash
npm run bench keyed/vanillajs keyed/stewie
```

To run only specific benchmarks:
```bash
npm run bench -- --benchmark 01_ 02_ 03_ 04_ 05_ 06_ --framework keyed/vanillajs keyed/stewie
```

**7. View results**

```bash
npm run results
# open http://localhost:8080/webdriver-ts-results/table.html
```

## Quick smoke test (no full benchmark run)

```bash
# Start the static server
npm start
# → open http://localhost:8080/frameworks/keyed/stewie/
# Click all six buttons and verify the table updates correctly
```

Or run one iteration automatically:
```bash
npm run bench -- --framework keyed/stewie --count 1 --smoketest
```

## Benchmark IDs

| ID | Operation |
|----|-----------|
| 01 | create 1,000 rows |
| 02 | replace 1,000 rows |
| 03 | partial update (every 10th row) |
| 04 | select row |
| 05 | swap rows |
| 06 | remove row |
| 07 | create 10,000 rows |
| 08 | append 1,000 rows |
| 09 | clear rows |
| 21 | startup time |
| 22 | memory after page load |
| 23 | memory after 1,000 rows |
| 24 | memory after update |

## Implementation notes

- **Per-row label signals** — each row stores its label as a `Signal<string>`.
  The partial-update benchmark (03) changes only those label signals — only
  the affected `<a class="lbl">` text nodes re-run. The rest of the table
  is untouched at the DOM level.
- **Keyed `For`** — rows are diffed by `id`, so swapRows (05) moves DOM nodes
  rather than recreating them.
- **`batch()`** — the partial update wraps all label writes so effects flush
  together.
- **No sub-components per row** — avoids component-call overhead in the hot path.
- **Bundle size** — ~3.9 kB gzipped for the full app + framework runtime.
