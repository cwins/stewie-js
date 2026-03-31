import { execSync } from 'node:child_process';

export function setup() {
  execSync('pnpm run mock:create-empty', { cwd: import.meta.dirname });
}

export function teardown() {
  execSync('pnpm run mock:clean', { cwd: import.meta.dirname });
}
