import type { Connection } from '../stores/connection'

/**
 * Stale-while-revalidate cache in localStorage: show the last good response immediately, then
 * refresh in the background. Entries are namespaced by the Floppy address and wiped when the
 * connection (instance / token) changes, so one account's data is never shown to another.
 */
const PREFIX = 'diskmate.swr.v1:'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface Entry<T> {
  at: number
  data: T
}

/** `<effective Floppy address>|<name>`: the address in use (local-only mode uses the local one). */
export const cacheKey = (conn: Connection, name: string): string =>
  `${conn.localOnly ? (conn.localBaseUrl ?? '') : conn.baseUrl}|${name}`

export const detailName = (mediaType: string, source: string, mediaId: string): string =>
  `detail:${mediaType}/${source}/${mediaId}`

export function readCache<T>(key: string): Entry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const e = JSON.parse(raw) as Entry<T>
    if (typeof e.at !== 'number' || Date.now() - e.at > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return e
  } catch {
    return null
  }
}

export function clearCache(): void {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k)
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

export function writeCache<T>(key: string, data: T): void {
  const value = JSON.stringify({ at: Date.now(), data } satisfies Entry<T>)
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    // Quota: drop the whole cache (it is only an accelerator) and try once more.
    clearCache()
    try {
      localStorage.setItem(PREFIX + key, value)
    } catch {
      /* still too big: skip caching this entry */
    }
  }
}

/** Forget one entry (call after a change that makes it wrong, e.g. a tracking update). */
export function dropCached(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}

export interface SwrHandlers<T> {
  /** Called with the cached copy first (fromCache = true), then with the fresh one. */
  onData: (data: T, fromCache: boolean) => void
  /** Called when the refresh failed; `hadCache` says whether stale data is already on screen. */
  onError?: (error: unknown, hadCache: boolean) => void
}

export async function swr<T>(key: string, fetcher: () => Promise<T>, h: SwrHandlers<T>): Promise<void> {
  const hit = readCache<T>(key)
  if (hit) h.onData(hit.data, true)
  try {
    const fresh = await fetcher()
    writeCache(key, fresh)
    h.onData(fresh, false)
  } catch (e) {
    h.onError?.(e, !!hit)
  }
}
