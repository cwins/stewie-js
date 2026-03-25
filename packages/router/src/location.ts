// location.ts — reactive location store

import { store, createRoot } from '@stewie-js/core'
import type { ReactiveLocation } from '@stewie-js/router-spi'

export interface RouterStore extends ReactiveLocation {
  // Mutable internally, read-only externally via StewieRouterSPI
}

export function parseQuery(search: string): Record<string, string> {
  const result: Record<string, string> = {}
  // Remove leading '?' if present
  const qs = search.startsWith('?') ? search.slice(1) : search
  if (!qs) return result

  for (const part of qs.split('&')) {
    if (!part) continue
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) {
      result[decodeURIComponent(part)] = ''
    } else {
      const key = decodeURIComponent(part.slice(0, eqIdx))
      const value = decodeURIComponent(part.slice(eqIdx + 1))
      result[key] = value
    }
  }
  return result
}

export function parseUrl(url: string): {
  pathname: string
  query: Record<string, string>
  hash: string
} {
  // Handle relative URLs like '/path?a=1#hash'
  let rest = url
  let hash = ''
  let search = ''

  const hashIdx = rest.indexOf('#')
  if (hashIdx !== -1) {
    hash = rest.slice(hashIdx + 1)
    rest = rest.slice(0, hashIdx)
  }

  const qIdx = rest.indexOf('?')
  if (qIdx !== -1) {
    search = rest.slice(qIdx)
    rest = rest.slice(0, qIdx)
  }

  const pathname = rest || '/'
  const query = parseQuery(search)

  return { pathname, query, hash }
}

export function createLocationStore(initialUrl?: string): RouterStore {
  const url = initialUrl ?? '/'
  const { pathname, query, hash } = parseUrl(url)

  return createRoot(() =>
    store<RouterStore>({
      pathname,
      params: {},
      query,
      hash,
    }),
  )
}
