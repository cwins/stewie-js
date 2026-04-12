import { describe, it, expect } from 'vitest';
import { version } from './index.js';

describe('@stewie-js/compiler', () => {
  it('exports version', () => {
    expect(version).toBe('0.7.1');
  });
});
