import { defineConfig } from 'vitest/config';
import { stewie } from '@stewie-js/vite';

export default defineConfig({
  plugins: [stewie()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Both suffixes end in `.test.ts`, so the include pattern picks them up.
    // Each needs its own harness — a built app plus a running server, and for
    // the gating suite a server started with STEWIE_CSS_DELAY. Run them with
    // `pnpm test:browser` / `pnpm test:gating`, which supply the globalSetup.
    exclude: ['src/**/*.browser.test.ts', 'src/**/*.gating.test.ts'],
    reporters: ['agent']
  }
});
