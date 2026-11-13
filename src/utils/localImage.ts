import type { Connection } from '../stores/connection'

/** In local-only mode, only load images served by the selected Floppy host. */
export function localImageUrl(image: unknown, connection: Connection): string | null {
  if (typeof image !== 'string' || !image) return null
  if (!connection.localOnly) return image
  try {
    const host = new URL(connection.localBaseUrl ?? '')
    const resolved = new URL(image, host)
    return resolved.origin === host.origin ? resolved.href : null
  } catch {
    return null
  }
}

const IMAGE_FIELDS = new Set(['image', 'backdrop', 'cover', 'poster', 'still', 'still_path'])

/** Sanitize nested detail payloads that contain image URLs (for example screenshots). */
export function localizeImageFields(value: Record<string, unknown>, connection: Connection) {
  const walk = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(walk)
    if (entry == null || typeof entry !== 'object') return entry
    return Object.fromEntries(
      Object.entries(entry).map(([key, child]) => [
        key,
        IMAGE_FIELDS.has(key) && typeof child === 'string' ? localImageUrl(child, connection) : walk(child),
      ]),
    )
  }
  return walk(value) as Record<string, unknown>
}
