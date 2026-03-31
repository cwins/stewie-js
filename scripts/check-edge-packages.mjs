#!/usr/bin/env node
/**
 * check-edge-packages.mjs
 *
 * Verifies that edge-sensitive packages do not import Node-only runtime APIs.
 * Run via: node scripts/check-edge-packages.mjs
 *
 * These packages must stay within Web Platform / WinterCG APIs so they work
 * in Cloudflare Workers, Deno Deploy, and similar edge runtimes, not just Node.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const EDGE_PACKAGES = [
  'packages/server/src',
  'packages/router/src',
]

// Node-specific modules that have no WinterCG equivalent. These must not appear
// in edge-sensitive source files. Test files are excluded from this check.
const FORBIDDEN = [
  // Node built-ins (node: prefix)
  { pattern: /from ['"]node:fs['"]/, label: 'node:fs' },
  { pattern: /from ['"]node:http['"]/, label: 'node:http' },
  { pattern: /from ['"]node:https['"]/, label: 'node:https' },
  { pattern: /from ['"]node:net['"]/, label: 'node:net' },
  { pattern: /from ['"]node:tls['"]/, label: 'node:tls' },
  { pattern: /from ['"]node:dgram['"]/, label: 'node:dgram' },
  { pattern: /from ['"]node:child_process['"]/, label: 'node:child_process' },
  { pattern: /from ['"]node:worker_threads['"]/, label: 'node:worker_threads' },
  { pattern: /from ['"]node:buffer['"]/, label: 'node:buffer' },
  { pattern: /from ['"]node:stream['"]/, label: 'node:stream' },
  // Bare module IDs (pre-node: era)
  { pattern: /from ['"]fs['"]/, label: "'fs'" },
  { pattern: /from ['"]http['"]/, label: "'http'" },
  { pattern: /from ['"]https['"]/, label: "'https'" },
  { pattern: /from ['"]net['"]/, label: "'net'" },
  { pattern: /from ['"]tls['"]/, label: "'tls'" },
  // require() calls
  { pattern: /require\(['"](?:node:)?(?:fs|http|https|net|tls|dgram|child_process|worker_threads)['"]\)/, label: 'require(node-api)' },
]

function scanDir(dir) {
  let violations = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      violations = violations.concat(scanDir(full))
      continue
    }
    const ext = extname(entry)
    if (ext !== '.ts' && ext !== '.tsx') continue
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue

    const lines = readFileSync(full, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const { pattern, label } of FORBIDDEN) {
        if (pattern.test(lines[i])) {
          violations.push({ file: full, line: i + 1, text: lines[i].trim(), label })
        }
      }
    }
  }
  return violations
}

let violations = []
for (const pkg of EDGE_PACKAGES) {
  violations = violations.concat(scanDir(pkg))
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`[edge-check] ${v.file}:${v.line} — ${v.label}`)
    console.error(`             ${v.text}`)
  }
  console.error(`\n[edge-check] FAIL: ${violations.length} Node-only import(s) in edge-sensitive packages.`)
  console.error('[edge-check] Use Web Platform equivalents (fetch, Request, Response, ReadableStream, URL, etc.)')
  process.exit(1)
}

console.log(`[edge-check] OK — no Node-only imports in edge-sensitive packages.`)
