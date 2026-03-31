#!/usr/bin/env node
export const version = '0.4.0';

// Exports for programmatic use
export { generateFiles } from './templates.js';
export { scaffoldProject } from './scaffold.js';
export { parseArgs } from './prompts.js';
export type { ScaffoldOptions } from './prompts.js';
export type { TemplateContext } from './templates.js';

import { promptUser } from './prompts.js';
import { generateFiles } from './templates.js';
import { scaffoldProject, printSuccess } from './scaffold.js';
import { join } from 'node:path';

async function main() {
  const args = process.argv.slice(2);
  const options = await promptUser(args);

  const targetDir = join(process.cwd(), options.projectName);

  const files = generateFiles(options);
  await scaffoldProject(targetDir, files);
  printSuccess(options.projectName, targetDir);
}

// Only run when executed directly
if (process.argv[1]?.endsWith('index.js') || process.argv[1]?.endsWith('index.ts')) {
  main().catch(console.error);
}
