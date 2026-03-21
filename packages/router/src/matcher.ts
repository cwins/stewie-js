// matcher.ts — URL pattern matching

export interface MatchResult {
  params: Record<string, string>
  score: number
}

// Match a URL pathname against a route pattern.
// Pattern syntax: '/users/:id', '/users/:id/posts', '/about'
// Returns null if no match, or params + score if matched.
export function matchRoute(pattern: string, pathname: string): MatchResult | null {
  const patternSegments = pattern.split('/').filter(Boolean)
  const pathSegments = pathname.split('/').filter(Boolean)

  // Check for wildcard at the end
  const hasWildcard = patternSegments[patternSegments.length - 1] === '*'
  const effectivePatternSegments = hasWildcard
    ? patternSegments.slice(0, -1)
    : patternSegments

  // Segment count must match exactly unless there's a wildcard
  if (hasWildcard) {
    if (pathSegments.length < effectivePatternSegments.length) return null
  } else {
    if (patternSegments.length !== pathSegments.length) return null
  }

  const params: Record<string, string> = {}
  let score = 0

  for (let i = 0; i < effectivePatternSegments.length; i++) {
    const patSeg = effectivePatternSegments[i]
    const pathSeg = pathSegments[i]

    if (patSeg.startsWith(':')) {
      // Dynamic param segment
      const paramName = patSeg.slice(1)
      // Empty param is not a match
      if (!pathSeg || pathSeg.length === 0) return null
      params[paramName] = pathSeg
      score += 1
    } else {
      // Static segment — must match exactly
      if (patSeg !== pathSeg) return null
      score += 10
    }
  }

  return { params, score }
}

// Sort routes by specificity (more specific = lower index).
// Higher score = more specific = earlier in array.
export function sortRoutes<T extends { path: string }>(routes: T[]): T[] {
  return [...routes].sort((a, b) => {
    const scoreA = getPatternScore(a.path)
    const scoreB = getPatternScore(b.path)
    // Higher score = more specific = sort first
    return scoreB - scoreA
  })
}

function getPatternScore(pattern: string): number {
  const segments = pattern.split('/').filter(Boolean)
  let score = 0
  for (const seg of segments) {
    if (seg.startsWith(':')) {
      score += 1
    } else if (seg === '*') {
      score += 0
    } else {
      score += 10
    }
  }
  return score
}
