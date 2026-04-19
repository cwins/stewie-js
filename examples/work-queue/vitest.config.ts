import { defineConfig } from 'vitest/config';
import { stewie } from '@stewie-js/vite';

export default defineConfig({
  plugins: [stewie()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.browser.test.ts'],
    reporters: ['agent']
  }
});
