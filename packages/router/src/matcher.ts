// matcher.ts — URL pattern matching

export interface MatchResult {
  params: Record<string, string>
  score: number
}

// ---------------------------------------------------------------------------
// Compiled pattern — pre-parsed once per unique pattern string
// ---------------------------------------------------------------------------

interface CompiledPattern {
  /** Segments with the trailing '*' removed (if present). */
  segments: string[]
  hasWildcard: boolean
  /**
   * Static specificity score for sorting — same formula as matchRoute uses
   * per-match but computed once rather than on every navigation.
   */
  score: number
}

// Module-level cache: pattern strings are immutable, so a plain Map is safe.
// Route tables are small (typically <20 entries) so memory is not a concern.
const _compiledPatterns = new Map<string, CompiledPattern>()

function getCompiledPattern(pattern: string): CompiledPattern {
  let compiled = _compiledPatterns.get(pattern)
  if (!compiled) {
    const raw = pattern.split('/').filter(Boolean)
    const hasWildcard = raw[raw.length - 1] === '*'
    const segments = hasWildcard ? raw.slice(0, -1) : raw
    let score = 0
    for (const seg of segments) {
      if (seg === '*') {
        // wildcard mid-pattern (unusual, treat as low-specificity)
      } else if (seg.startsWith(':')) {
        score += 1
      } else {
        score += 10
      }
    }
    compiled = { segments, hasWildcard, score }
    _compiledPatterns.set(pattern, compiled)
  }
  return compiled
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Match a URL pathname against a route pattern.
// Pattern syntax: '/users/:id', '/users/:id/posts', '/about'
// Returns null if no match, or params + score if matched.
export function matchRoute(pattern: string, pathname: string): MatchResult | null {
  const { segments: patternSegments, hasWildcard, score: baseScore } = getCompiledPattern(pattern)
  const pathSegments = pathname.split('/').filter(Boolean)

  // Segment count must match exactly unless there's a wildcard
  if (hasWildcard) {
    if (pathSegments.length < patternSegments.length) return null
  } else {
    if (patternSegments.length !== pathSegments.length) return null
  }

  const params: Record<string, string> = {}
  let score = baseScore

  for (let i = 0; i < patternSegments.length; i++) {
    const patSeg = patternSegments[i]
    const pathSeg = pathSegments[i]

    if (patSeg.startsWith(':')) {
      // Dynamic param segment — score already included in baseScore
      const paramName = patSeg.slice(1)
      // Empty param is not a match
      if (!pathSeg || pathSeg.length === 0) return null
      params[paramName] = pathSeg
    } else {
      // Static segment — must match exactly; score already in baseScore
      if (patSeg !== pathSeg) return null
    }
  }

  // Wildcard matches add no score for the extra path segments
  return { params, score }
}

// Sort routes by specificity (more specific = lower index).
// Higher score = more specific = earlier in array.
export function sortRoutes<T extends { path: string }>(routes: T[]): T[] {
  return [...routes].sort((a, b) => {
    // getCompiledPattern caches, so this is cheap on repeat calls
    return getCompiledPattern(b.path).score - getCompiledPattern(a.path).score
  })
}
