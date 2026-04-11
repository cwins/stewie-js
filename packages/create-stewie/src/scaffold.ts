import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export async function scaffoldProject(targetDir: string, files: Array<{ path: string; content: string }>): Promise<void> {
  await mkdir(targetDir, { recursive: true });

  for (const file of files) {
    const fullPath = join(targetDir, file.path);
    const dir = dirname(fullPath);
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, file.content, 'utf-8');
  }
}

export function printSuccess(projectName: string, targetDir: string): void {
  console.log(`\nProject "${projectName}" created successfully at ${targetDir}`);
  console.log('\nTo get started, run:\n');
  console.log(`  cd ${projectName} && pnpm install && pnpm dev`);
  console.log();
}
