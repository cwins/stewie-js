import { describe, it, expect } from 'vitest';
import { version } from './index.js';

describe('@stewie-js/adapter-node', () => {
  it('exports version', () => {
    expect(version).toBe('0.4.0');
  });
});
