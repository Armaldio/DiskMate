import type { Connection } from '../stores/connection'
import { FEATURE_SCOPES, InsufficientScopeError } from './scopes'

export interface MediaItem {
  mediaType: string
  source: string
  mediaId: string
  title: string
  image: string | null
}

export interface Rail {
  key: string
  title: string
  summary: string | null
  items: MediaItem[]
}

async function request(
  conn: Connection,
  path: string,
  scopes: readonly string[],
): Promise<unknown> {
  const res = await fetch(`${conn.baseUrl}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${conn.token}`,
      'X-API-Key': conn.token,
    },
  })
  if (res.status === 401) throw new Error('Invalid API token')
  if (res.status === 403) throw new InsufficientScopeError([...scopes])
  if (!res.ok) throw new Error(`Floppy responded with HTTP ${res.status}`)
  return res.json()
}

/** Verifies URL + token. Network/CORS failures get a friendlier message. */
export async function testConnection(conn: Connection): Promise<void> {
  try {
    await request(conn, '/api/v1/user/preferences/', FEATURE_SCOPES.connection)
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        'Could not reach the instance (wrong URL, or CORS is blocking this origin).',
      )
    }
    throw e
  }
}

type Json = Record<string, unknown>

/** GET /api/v1/discover/ → curated rows such as "Trending Right Now". */
export async function fetchDiscover(conn: Connection, mediaType?: string): Promise<Rail[]> {
  const q = mediaType ? `?media_type=${encodeURIComponent(mediaType)}` : ''
  const data = (await request(conn, `/api/v1/discover/${q}`, FEATURE_SCOPES.discover)) as Json
  const rows = Array.isArray(data.rows) ? (data.rows as Json[]) : []
  return rows
    .map((row, i): Rail => {
      const items = (Array.isArray(row.items) ? (row.items as Json[]) : []).flatMap(
        (it): MediaItem[] => {
          if (it.media_id == null || !it.media_type) return []
          return [
            {
              mediaType: String(it.media_type),
              source: String(it.source ?? 'tmdb'),
              mediaId: String(it.media_id),
              title: String(it.title ?? 'Untitled'),
              image: typeof it.image === 'string' ? it.image : null,
            },
          ]
        },
      )
      return {
        key: String(row.key ?? i),
        title: String(row.title ?? 'Untitled'),
        summary: typeof row.why === 'string' ? row.why : null,
        items,
      }
    })
    .filter((r) => r.items.length > 0)
}
