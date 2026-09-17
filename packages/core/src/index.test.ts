import { describe, it, expect } from 'vitest';
import { version } from './index.js';
import pkg from '../package.json';

describe('@stewie-js/core', () => {
  it('exports a version matching package.json', () => {
    // Compare against package.json, not a hardcoded literal. A literal only
    // proves the constant matches the test — circular, and it stays green while
    // the package ships a stale version. (0.10.4 nearly shipped with
    // version === '0.10.3' and every one of these tests passed.)
    expect(version).toBe(pkg.version);
  });
});
