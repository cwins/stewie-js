export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function titleCase(value: string): string {
  if (!value) return 'Unknown'
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatAirDate(value: string): string {
  if (!value) return 'Unknown air date'
  return value
}

export function getSeasonLabel(code: string): string {
  const match = /^S(\d+)/.exec(code)
  if (!match) return 'Unknown season'
  return `Season ${match[1]}`
}

export function getSeasonCode(code: string): string {
  const match = /^S(\d+)/.exec(code)
  return match ? `S${match[1]}` : ''
}

export function statusTone(status: string): 'alive' | 'dead' | 'unknown' {
  const normalized = status.toLowerCase()
  if (normalized === 'alive') return 'alive'
  if (normalized === 'dead') return 'dead'
  return 'unknown'
}

export function parsePage(value: string | undefined): number {
  const num = Number(value)
  return Number.isFinite(num) && num >= 1 ? Math.floor(num) : 1
}

export function parseId(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return /^\d+$/.test(trimmed) ? trimmed : null
}

export function buildPath(pathname: string, query: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const queryString = search.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
