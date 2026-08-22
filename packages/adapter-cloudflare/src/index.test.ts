import { describe, it, expect } from 'vitest';
import { version } from './index.js';

describe('@stewie-js/adapter-cloudflare', () => {
  it('exports version', () => {
    expect(version).toBe('0.10.1');
  });
});
