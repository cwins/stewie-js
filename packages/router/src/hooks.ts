// hooks.ts — router hooks

import { useRouter } from './router.js'
import type { RouterStore } from './location.js'

export function useLocation(): RouterStore {
  return useRouter().location as RouterStore
}

export function useParams<T extends Record<string, string>>(): T {
  return useRouter().location.params as T
}

export function useQuery<T extends Record<string, string>>(): T {
  return useRouter().location.query as T
}
