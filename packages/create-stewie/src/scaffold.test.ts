import { describe, it, expect, afterEach } from 'vitest';
import { scaffoldProject } from './scaffold.js';
import { rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('scaffoldProject', () => {
  const testDir = join(tmpdir(), `stewie-test-${Date.now()}`);

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('creates files in target directory', async () => {
    await scaffoldProject(testDir, [
      { path: 'package.json', content: '{"name":"test"}' },
      { path: 'src/main.ts', content: 'export {}' }
    ]);

    const pkg = await readFile(join(testDir, 'package.json'), 'utf-8');
    expect(JSON.parse(pkg).name).toBe('test');

    const main = await readFile(join(testDir, 'src/main.ts'), 'utf-8');
    expect(main).toBe('export {}');
  });

  it('creates nested directories as needed', async () => {
    await scaffoldProject(testDir, [{ path: 'a/b/c/deep.ts', content: 'export {}' }]);
    const content = await readFile(join(testDir, 'a/b/c/deep.ts'), 'utf-8');
    expect(content).toBe('export {}');
  });
});
