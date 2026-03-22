// sourcemap.ts — basic V3 source map generation

export interface SourceMapEntry {
  generatedLine: number
  generatedColumn: number
  originalLine: number
  originalColumn: number
}

// VLQ base64 encoding for source maps
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(value: number): string {
  return BASE64_CHARS[value] ?? ''
}

function encodeVlq(value: number): string {
  // Convert to signed VLQ representation
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1
  let result = ''

  do {
    let digit = vlq & 0x1f
    vlq >>>= 5
    if (vlq > 0) {
      digit |= 0x20 // continuation bit
    }
    result += toBase64(digit)
  } while (vlq > 0)

  return result
}

function encodeMappings(entries: SourceMapEntry[]): string {
  if (entries.length === 0) return ''

  // Group entries by generated line
  const byLine = new Map<number, SourceMapEntry[]>()
  for (const entry of entries) {
    const line = entry.generatedLine
    if (!byLine.has(line)) {
      byLine.set(line, [])
    }
    byLine.get(line)!.push(entry)
  }

  const maxLine = Math.max(...byLine.keys())
  const segments: string[] = []

  let prevOrigLine = 0
  let prevOrigCol = 0

  for (let line = 1; line <= maxLine; line++) {
    const lineEntries = byLine.get(line) ?? []
    lineEntries.sort((a, b) => a.generatedColumn - b.generatedColumn)

    const lineSegments: string[] = []
    let prevGenCol = 0

    for (const entry of lineEntries) {
      const genColDelta = entry.generatedColumn - prevGenCol
      const origLineDelta = entry.originalLine - prevOrigLine
      const origColDelta = entry.originalColumn - prevOrigCol

      lineSegments.push(
        encodeVlq(genColDelta) +
          encodeVlq(0) + // source file index delta (always 0)
          encodeVlq(origLineDelta) +
          encodeVlq(origColDelta),
      )

      prevGenCol = entry.generatedColumn
      prevOrigLine = entry.originalLine
      prevOrigCol = entry.originalColumn
    }

    segments.push(lineSegments.join(','))
  }

  return segments.join(';')
}

export function generateSourceMap(
  filename: string,
  originalSource: string,
  entries: SourceMapEntry[],
): string {
  const map = {
    version: 3,
    file: filename,
    sourceRoot: '',
    sources: [filename],
    sourcesContent: [originalSource],
    names: [],
    mappings: encodeMappings(entries),
  }

  return JSON.stringify(map)
}

export function toInlineSourceMap(mapJson: string): string {
  const base64 = Buffer.from(mapJson).toString('base64')
  return `//# sourceMappingURL=data:application/json;base64,${base64}`
}

/**
 * Generate a basic identity source map — original positions = generated positions.
 * This is a simplified version that records the start of each line.
 */
export function generateIdentitySourceMap(filename: string, source: string): string {
  const lines = source.split('\n')
  const entries: SourceMapEntry[] = []

  for (let i = 0; i < lines.length; i++) {
    entries.push({
      generatedLine: i + 1,
      generatedColumn: 0,
      originalLine: i + 1,
      originalColumn: 0,
    })
  }

  return generateSourceMap(filename, source, entries)
}
