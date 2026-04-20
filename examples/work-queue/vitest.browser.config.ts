import { defineConfig } from 'vitest/config';

export const BROWSER_TEST_PORT = 3098;
export const BROWSER_TEST_URL = `http://localhost:${BROWSER_TEST_PORT}`;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.browser.test.ts'],
    globalSetup: ['src/browser-setup.ts'],
    testTimeout: 10_000,
    reporters: ['hanging-process', 'tree', 'agent']
  }
});
