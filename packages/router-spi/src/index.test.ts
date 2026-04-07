import { describe, it, expect } from 'vitest';
import { version } from './index.js';

describe('@stewie-js/router-spi', () => {
  it('exports version', () => {
    expect(version).toBe('0.6.0');
  });
});
