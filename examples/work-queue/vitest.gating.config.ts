import { defineConfig } from 'vitest/config';

// Separate from vitest.browser.config.ts so the CSS-delay middleware in the
// example server only slows down the gating suite, not the full browser suite.
export const GATING_TEST_PORT = 3099;
export const GATING_TEST_URL = `http://localhost:${GATING_TEST_PORT}`;
export const GATING_CSS_DELAY_MS = 400;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.gating.test.ts'],
    globalSetup: ['src/gating-setup.ts'],
    testTimeout: 20_000,
    reporters: ['hanging-process', 'tree', 'agent']
  }
});
