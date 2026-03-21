import { createInterface } from 'node:readline/promises'

export interface ScaffoldOptions {
  projectName: string
  mode: 'static' | 'ssr'
  ssrRuntime?: 'node' | 'bun'
  includeRouter: boolean
}

export async function promptUser(args: string[]): Promise<ScaffoldOptions> {
  const partial = parseArgs(args)

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    let projectName = partial.projectName
    if (!projectName) {
      projectName = await rl.question('Project name: ')
      if (!projectName) projectName = 'my-stewie-app'
    }

    let mode = partial.mode
    if (!mode) {
      const modeAnswer = await rl.question('Mode (static/ssr) [static]: ')
      const trimmed = modeAnswer.trim().toLowerCase()
      mode = trimmed === 'ssr' ? 'ssr' : 'static'
    }

    let ssrRuntime = partial.ssrRuntime
    if (mode === 'ssr' && !ssrRuntime) {
      const runtimeAnswer = await rl.question('SSR runtime (node/bun) [node]: ')
      const trimmed = runtimeAnswer.trim().toLowerCase()
      ssrRuntime = trimmed === 'bun' ? 'bun' : 'node'
    }

    let includeRouter = partial.includeRouter
    if (includeRouter === undefined) {
      const routerAnswer = await rl.question('Include router? (y/n) [n]: ')
      includeRouter = routerAnswer.trim().toLowerCase() === 'y'
    }

    return {
      projectName,
      mode,
      ssrRuntime: mode === 'ssr' ? (ssrRuntime ?? 'node') : undefined,
      includeRouter: includeRouter ?? false,
    }
  } finally {
    rl.close()
  }
}

export function parseArgs(args: string[]): Partial<ScaffoldOptions> {
  const result: Partial<ScaffoldOptions> = {}

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const withoutDashes = arg.slice(2)
      if (withoutDashes === 'router') {
        result.includeRouter = true
      } else if (withoutDashes.startsWith('mode=')) {
        const value = withoutDashes.slice(5)
        if (value === 'ssr' || value === 'static') {
          result.mode = value
        }
      } else if (withoutDashes.startsWith('runtime=')) {
        const value = withoutDashes.slice(8)
        if (value === 'node' || value === 'bun') {
          result.ssrRuntime = value
        }
      }
    } else if (!arg.startsWith('-')) {
      // First positional arg = project name
      if (!result.projectName) {
        result.projectName = arg
      }
    }
  }

  return result
}
