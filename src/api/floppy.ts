import type { Connection } from '../stores/connection'
import { localImageUrl, localizeImageFields } from '../utils/localImage'
import { FEATURE_SCOPES, InsufficientScopeError } from './scopes'

export interface MediaItem {
  mediaType: string
  source: string
  mediaId: string
  title: string
  image: string | null
  releaseDate: string | null
  /** Small extra line for search results (year, platforms…). */
  subtitle?: string | null
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
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<unknown> {
  const baseUrl = conn.localOnly ? conn.localBaseUrl : conn.baseUrl
  if (!baseUrl) throw new Error('Set a local Floppy address before using local-only mode.')
  const options: RequestInit = {
    method: init.method ?? 'GET',
    redirect: conn.localOnly ? 'error' : 'follow',
    signal: init.signal,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: {
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      // CORS-safelisted, so it adds no preflight requirement. Floppy may or may not honour it.
      'Accept-Language': navigator.languages?.join(',') || navigator.language || 'en',
      Authorization: `Bearer ${conn.token}`,
      'X-API-Key': conn.token,
    },
  }
  if (conn.localOnly) {
    const hostname = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '')
    const loopback = hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1' || hostname.startsWith('127.')
    Object.assign(options, { targetAddressSpace: loopback ? 'loopback' : 'local' })
  }
  const res = await fetch(`${baseUrl}${path}`, options)
  if (res.status === 401) throw new Error('Invalid API token')
  if (res.status === 403) throw new InsufficientScopeError([...scopes])
  if (!res.ok) throw await apiError(res)
  if (res.status === 204) return null
  return res.json().catch(() => null)
}

/** A non-2xx answer from Floppy, with its validation details (e.g. `{ errors: { progress: ['…'] } }`). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Names of the fields Floppy rejected. */
    public fields: string[] = [],
  ) {
    super(message)
  }
}

async function apiError(res: Response): Promise<ApiError> {
  let body: Json | null = null
  try {
    body = (await res.json()) as Json
  } catch {
    /* not JSON */
  }
  const errors = body?.errors && typeof body.errors === 'object' ? (body.errors as Record<string, unknown>) : {}
  const fields = Object.keys(errors)
  const detail = typeof body?.detail === 'string' ? body.detail : ''
  const why = fields.map((f) => `${f}: ${[errors[f]].flat().join(' ')}`).join('; ')
  const message = [detail, why].filter(Boolean).join(' — ') || `Floppy responded with HTTP ${res.status}`
  return new ApiError(res.status, message, fields)
}

/** Verifies URL + token. Network/CORS failures get a friendlier message. */
export async function testConnection(conn: Connection): Promise<void> {
  try {
    await request(conn, '/api/v1/user/preferences/', FEATURE_SCOPES.connection)
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        'Could not reach the instance (check the URL, browser local-network permission, redirects, and CORS settings).',
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
              image: localImageUrl(it.image, conn),
              releaseDate: typeof it.release_date === 'string' ? it.release_date : null,
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

export interface NextEpisode {
  mediaId: string | null
  source: string | null
  seasonNumber: number | null
  episodeNumber: number | null
  showTitle: string
  mediaType: string
  episodeCode: string | null
  episodeTitle: string | null
  airDate: string | null
  episodesLeft: number | null
  /** Share of the show watched (0-1); a guess from `progress` / (`progress` + `total_episodes_left`). */
  watchedRatio: number | null
  image: string | null
  /** The show's poster (used as the small chip in the watched sheet). */
  poster: string | null
  /** The season's own poster, when found (otherwise `image` is a fallback). */
  seasonImage: string | null
  lastWatched: string | null
}

const seasonKey = (source: unknown, mediaId: unknown, season: unknown) =>
  `${source}:${mediaId}:${season}`

/** Tracked seasons → poster URL, keyed by show source/id + season number. Best-effort. */
async function fetchSeasonImages(conn: Connection): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const libs = [undefined, 'anime']
  const results = await Promise.allSettled(
    libs.map((lib) => {
      const q = new URLSearchParams({ media_type: 'season', limit: '200' })
      if (lib) q.set('library_media_type', lib)
      return request(conn, `/api/v1/media/?${q}`, FEATURE_SCOPES.nextUp) as Promise<Json>
    }),
  )
  for (const r of results) {
    if (r.status !== 'fulfilled' || !Array.isArray(r.value.results)) continue
    for (const row of r.value.results as Json[]) {
      const item = (row.item ?? {}) as Json
      const image = localImageUrl(item.image, conn)
      if (image) out.set(seasonKey(item.source, item.media_id, item.season_number), image)
    }
  }
  return out
}

/**
 * GET /api/v1/media/ → shows in progress that still have unwatched, released episodes,
 * most recently watched first. Each entry's `next_episode` is the one after the last you checked.
 */
export async function fetchNextUp(conn: Connection): Promise<NextEpisode[]> {
  const kinds = ['tv', 'anime']
  const pages = await Promise.all(
    kinds.map(async (kind) => {
      const q = new URLSearchParams({
        media_type: kind,
        status: '1', // In progress
        progress: 'not_caught_up',
        sort: 'last_watched',
        direction: 'desc',
        limit: '30',
      })
      const data = (await request(conn, `/api/v1/media/?${q}`, FEATURE_SCOPES.nextUp)) as Json
      return (Array.isArray(data.results) ? (data.results as Json[]) : []).map((r) => ({ kind, r }))
    }),
  )
  const seasonImages = await fetchSeasonImages(conn)
  const list = pages
    .flat()
    .flatMap(({ kind, r }): NextEpisode[] => {
      const next = r.next_episode as Json | null
      if (!next) return []
      const item = (r.item ?? {}) as Json
      const show = (r.show ?? {}) as Json
      const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
      return [
        {
          mediaId: item.media_id == null ? null : String(item.media_id),
          source: str(item.source),
          seasonNumber: typeof next.season_number === 'number' ? next.season_number : null,
          episodeNumber: typeof next.episode_number === 'number' ? next.episode_number : null,
          showTitle: str(show.title) ?? str(item.title) ?? 'Untitled',
          mediaType: str(item.media_type) ?? kind,
          episodeCode: str(next.episode_code),
          episodeTitle: str(next.title),
          airDate: str(next.air_date),
          episodesLeft: typeof r.episodes_left === 'number' ? r.episodes_left : null,
          watchedRatio:
            typeof r.progress === 'number' && typeof r.total_episodes_left === 'number' &&
            r.progress + r.total_episodes_left > 0
              ? r.progress / (r.progress + r.total_episodes_left)
              : null,
          poster: localImageUrl(str(item.image) ?? str(show.image), conn),
          seasonImage:
            seasonImages.get(seasonKey(item.source, item.media_id, next.season_number)) ?? null,
          // Prefer the season poster; fall back to the episode still, then the show image.
          image:
            seasonImages.get(seasonKey(item.source, item.media_id, next.season_number)) ??
            localImageUrl(str(next.image) ?? str(item.image) ?? str(show.image), conn),
          lastWatched: str(r.progressed_at),
        },
      ]
    })
    .sort((a, b) => (b.lastWatched ?? '').localeCompare(a.lastWatched ?? ''))
  // Entries the season list didn't match: ask the season endpoint directly (exact ids).
  await Promise.all(
    list.filter((e) => !e.seasonImage).map(async (e) => {
      e.seasonImage = await fetchSeasonImage(conn, e)
      if (e.seasonImage) e.image = e.seasonImage
    }),
  )
  return list
}

/** GET .../{season}/ → the season's own poster, or null (best-effort, never throws). */
async function fetchSeasonImage(conn: Connection, e: NextEpisode): Promise<string | null> {
  if (!e.source || !e.mediaId || e.seasonNumber == null) return null
  const lib = e.mediaType === 'anime' ? '?library_media_type=anime' : ''
  try {
    const d = (await request(
      conn,
      `/api/v1/media/tv/${encodeURIComponent(e.source)}/${encodeURIComponent(e.mediaId)}/${e.seasonNumber}/${lib}`,
      FEATURE_SCOPES.nextUp,
    )) as Json | null
    const item = (d?.item ?? {}) as Json
    const img = [d?.image, item.image, (d?.season as Json | undefined)?.image].find(
      (v) => typeof v === 'string' && v,
    )
    return localImageUrl(img, conn)
  } catch {
    return null
  }
}

export interface SeasonEpisode {
  number: number
  title: string | null
  image: string | null
  airDate: string | null
}

/** Finds the first array of objects that look like episodes anywhere in a response. */
function findEpisodeRows(data: unknown, depth = 0): Json[] {
  if (depth > 4 || data == null || typeof data !== 'object') return []
  if (Array.isArray(data)) {
    const rows = data.filter((r): r is Json => r != null && typeof r === 'object')
    const looksLikeEpisodes = (r: Json) =>
      r.episode_number != null || ((r.item ?? {}) as Json).episode_number != null
    return rows.some(looksLikeEpisodes) ? rows : data.flatMap((d) => findEpisodeRows(d, depth + 1))
  }
  for (const v of Object.values(data as Json)) {
    const found = findEpisodeRows(v, depth + 1)
    if (found.length) return found
  }
  return []
}

/**
 * The season's episodes from the next one on. The response shape isn't documented, so rows are
 * found structurally; tries `.../{season}/episodes/`, then the season detail endpoint.
 */
export async function fetchSeasonEpisodes(
  conn: Connection,
  ep: NextEpisode,
): Promise<SeasonEpisode[]> {
  if (!ep.mediaId || !ep.source || ep.seasonNumber == null) return []
  const lib = ep.mediaType === 'anime' ? '?library_media_type=anime' : ''
  const base = `/api/v1/media/tv/${encodeURIComponent(ep.source)}/${encodeURIComponent(ep.mediaId)}/${ep.seasonNumber}/`
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  let rows: Json[] = []
  for (const path of [`${base}episodes/${lib}`, `${base}${lib}`]) {
    try {
      rows = findEpisodeRows(await request(conn, path, FEATURE_SCOPES.nextUp))
    } catch (e) {
      if (e instanceof InsufficientScopeError) throw e
    }
    if (rows.length) break
  }
  return rows
    .flatMap((r): SeasonEpisode[] => {
      const item = (r.item ?? {}) as Json
      const n = Number(r.episode_number ?? item.episode_number)
      if (!Number.isFinite(n)) return []
      const pick = (k: string) => str(r[k]) ?? str(item[k])
      return [
        {
          number: n,
          title: pick('title') ?? pick('name'),
          image: localImageUrl(pick('image') ?? pick('still_path') ?? pick('still'), conn),
          airDate: pick('air_date') ?? pick('release_datetime'),
        },
      ]
    })
    .filter((e) => ep.episodeNumber == null || e.number >= ep.episodeNumber)
    .sort((a, b) => a.number - b.number)
}

export interface WatchExtras {
  /** 0-10 (halves allowed). */
  score?: number
  notes?: string
}

/**
 * POST .../{season}/episodes/{episode}/watch/ → records one watch (verified against a live instance).
 * `when`: undefined = now (server stamps it); an ISO string with a zone (e.g. `…Z`) = that moment
 * (zone-less times are read in the server's timezone). `score` goes in the same call; notes are
 * saved by editing the new history entry.
 */
export async function markEpisodeWatched(
  conn: Connection,
  ep: NextEpisode,
  episodeNumber: number,
  when?: string,
  extras: WatchExtras = {},
): Promise<void> {
  if (!ep.mediaId || !ep.source || ep.seasonNumber == null) {
    throw new Error('Missing episode identifiers from Floppy')
  }
  const lib = ep.mediaType === 'anime' ? '?library_media_type=anime' : ''
  const season = `/api/v1/media/tv/${encodeURIComponent(ep.source)}/${encodeURIComponent(ep.mediaId)}/${ep.seasonNumber}`
  const created = (await request(conn, `${season}/episodes/${episodeNumber}/watch/${lib}`, FEATURE_SCOPES.markWatched, {
    method: 'POST',
    body: { ...(when ? { end_date: when } : {}), ...(extras.score != null ? { score: extras.score } : {}) },
  })) as Json | null
  if (!extras.notes) return
  const id = created?.consumption_id
  if (id == null) throw new Error('Watch recorded, but the notes could not be saved (no history id)')
  await request(conn, `${season}/${episodeNumber}/history/${id}/${lib}`, FEATURE_SCOPES.markWatched, {
    method: 'PATCH',
    body: { notes: extras.notes },
  })
}

/**
 * Movies: POST .../movie/{source}/{id}/watch/ takes the date only; score and notes live on the
 * tracked movie, so they are saved with PATCH .../movie/{source}/{id}/ (both verified live).
 */
export async function markMovieWatched(
  conn: Connection,
  movie: MediaItem,
  when?: string,
  extras: WatchExtras = {},
): Promise<void> {
  const path = `/api/v1/media/movie/${encodeURIComponent(movie.source)}/${encodeURIComponent(movie.mediaId)}/`
  await request(conn, `${path}watch/`, FEATURE_SCOPES.markWatched, {
    method: 'POST',
    body: when ? { end_date: when } : {},
  })
  if (extras.score == null && !extras.notes) return
  await request(conn, path, FEATURE_SCOPES.markWatched, {
    method: 'PATCH',
    body: {
      ...(extras.score != null ? { score: extras.score } : {}),
      ...(extras.notes ? { notes: extras.notes } : {}),
    },
  })
}

export interface TrackingEntry {
  status: number | null
  /** 0-10 */
  score: number | null
  progress: number | null
  startDate: string | null
  endDate: string | null
  notes: string
}

export interface Person {
  id: string
  name: string
  image: string | null
  /** Character (cast) or job (crew) when Floppy provides it, else the department. */
  role: string | null
}

/** Normalised `GET /api/v1/media/{type}/{source}/{id}/`: identical shape for every media type. */
export interface MediaDetail {
  mediaType: string
  source: string
  mediaId: string
  title: string
  image: string | null
  backdrop: string | null
  synopsis: string | null
  genres: string[]
  /** Community score on a 0-10 scale. */
  score: number | null
  scoreCount: number | null
  imdbRating: number | null
  cast: Person[]
  crew: Person[]
  /** Type-specific facts (see each `components/details/*Detail.vue`). */
  details: Record<string, unknown>
  /** Type-specific related items (seasons, DLCs, …). */
  related: Record<string, unknown>
  tracked: boolean
  /** Tracking status of the user's entry: 0 Planning (watchlist), 1 In progress, 2 Paused, 3 Completed, 4 Dropped. */
  status: number | null
  /** The user's own tracking values (not the community score), when the item is tracked. */
  entry: TrackingEntry | null
  maxProgress: number | null
  sourceUrl: string | null
}

/** The status of the user's most relevant entry: Completed wins, then the first listed. */
function trackingStatus(consumptions: unknown): number | null {
  const list = (Array.isArray(consumptions) ? (consumptions as Json[]) : [])
    .map((c) => c.status)
    .filter((v): v is number => typeof v === 'number')
  if (!list.length) return null
  return list.includes(3) ? 3 : list[0]
}

/** GET /api/v1/media/ → tracked items, following only Floppy's same-origin `next` links. */
export async function fetchLibrary(conn: Connection): Promise<MediaItem[]> {
  const baseUrl = conn.localOnly ? conn.localBaseUrl : conn.baseUrl
  if (!baseUrl) throw new Error('Set a local Floppy address before using local-only mode.')
  const parsedBase = new URL(baseUrl)
  const basePath = parsedBase.pathname.replace(/\/+$/, '')
  const mediaPath = `${basePath}/api/v1/media/`
  let pageUrl = new URL(`${mediaPath}?limit=200`, parsedBase.origin)
  const seen = new Set<string>()
  const items = new Map<string, MediaItem>()
  const statuses = ['Watchlist', 'In progress', 'Paused', 'Completed', 'Dropped']

  while (!seen.has(pageUrl.href)) {
    seen.add(pageUrl.href)
    const path = `${pageUrl.pathname.slice(basePath.length)}${pageUrl.search}`
    const data = (await request(conn, path, FEATURE_SCOPES.library)) as Json
    const rows = Array.isArray(data.results) ? (data.results as Json[]) : []
    for (const row of rows) {
      const item = (row.item ?? {}) as Json
      const mediaType = item.media_type ?? row.media_type
      const mediaId = item.media_id ?? row.media_id
      if (mediaType == null || mediaId == null) continue
      const source = String(item.source ?? row.source ?? 'tmdb')
      const status = typeof row.status === 'number' ? row.status : trackingStatus(row.consumptions)
      const normalized: MediaItem = {
        mediaType: String(mediaType),
        source,
        mediaId: String(mediaId),
        title: String(item.title ?? row.title ?? 'Untitled'),
        image: localImageUrl(item.image, conn),
        releaseDate: typeof item.release_date === 'string' ? item.release_date : null,
        subtitle: status == null ? null : statuses[status] ?? 'Tracked',
      }
      items.set(`${normalized.mediaType}:${source}:${normalized.mediaId}`, normalized)
    }

    if (typeof data.next !== 'string' || !data.next) break
    const nextUrl = new URL(data.next, pageUrl)
    if (nextUrl.origin !== pageUrl.origin || nextUrl.pathname !== mediaPath) break
    pageUrl = nextUrl
  }
  return [...items.values()]
}

/** The user's most relevant entry: a Completed one wins, else the first listed. */
function primaryEntry(consumptions: unknown): TrackingEntry | null {
  const rows = (Array.isArray(consumptions) ? (consumptions as Json[]) : []).filter((c) => c && typeof c === 'object')
  if (!rows.length) return null
  const c = rows.find((r) => r.status === 3) ?? rows[0]
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return {
    status: num(c.status),
    score: num(c.score),
    progress: num(c.progress),
    startDate: str(c.start_date),
    endDate: str(c.end_date),
    notes: typeof c.notes === 'string' ? c.notes : '',
  }
}

export async function fetchMediaDetail(
  conn: Connection,
  mediaType: string,
  source: string,
  mediaId: string,
  /** Override for sub-resources that return the same shape (e.g. an episode). */
  path?: string,
): Promise<MediaDetail> {
  const d = (await request(
    conn,
    path ?? `/api/v1/media/${encodeURIComponent(mediaType)}/${encodeURIComponent(source)}/${encodeURIComponent(mediaId)}/`,
    FEATURE_SCOPES.details,
  )) as Json
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  const people = (v: unknown): Person[] =>
    (Array.isArray(v) ? (v as Json[]) : []).flatMap((p): Person[] =>
      str(p.name)
        ? [
            {
              id: String(p.person_id ?? p.name),
              name: str(p.name) as string,
              image: localImageUrl(p.image, conn),
              role: str(p.character) ?? str(p.job) ?? str(p.role) ?? str(p.known_for_department),
            },
          ]
        : [],
    )
  return {
    mediaType: str(d.media_type) ?? mediaType,
    source: str(d.source) ?? source,
    mediaId: String(d.media_id ?? mediaId),
    title: str(d.title) ?? 'Untitled',
    image: localImageUrl(d.image, conn),
    backdrop: localImageUrl(d.backdrop, conn),
    synopsis: str(d.synopsis),
    genres: (Array.isArray(d.genres) ? d.genres : []).filter((g): g is string => typeof g === 'string'),
    score: num(d.score),
    scoreCount: num(d.score_count),
    imdbRating: num(d.imdb_rating),
    cast: people(d.cast).slice(0, 30), // the page shows 20; long series list ~1000 (too big to cache)
    crew: people(d.crew).slice(0, 20),
    details: localizeImageFields(obj(d.details), conn),
    related: localizeImageFields(obj(d.related), conn),
    tracked: d.tracked === true,
    status: trackingStatus(d.consumptions),
    entry: primaryEntry(d.consumptions),
    maxProgress: num(d.max_progress),
    sourceUrl: str(d.source_url),
  }
}

/** GET /api/v1/search/{type}/?search=… → provider results, mapped to the shared card shape. */
export async function searchMedia(
  conn: Connection,
  mediaType: string,
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<MediaItem[]> {
  const q = new URLSearchParams({ search: query, limit: String(limit) })
  const data = (await request(
    conn,
    `/api/v1/search/${encodeURIComponent(mediaType)}/?${q}`,
    FEATURE_SCOPES.search,
    { signal },
  )) as Json | null
  const rows = Array.isArray(data?.results) ? (data.results as Json[]) : []
  return rows.flatMap((r): MediaItem[] => {
    if (r.media_id == null || typeof r.title !== 'string') return []
    const platforms = Array.isArray(r.platforms) ? (r.platforms as unknown[]).filter((p) => typeof p === 'string') : []
    const kind = typeof r.media_type === 'string' ? r.media_type : mediaType
    const subtitle = [
      kind === 'movie' || kind === 'tv' ? kind : null, // movies and shows are listed together
      r.year != null ? String(r.year) : null,
      platforms.slice(0, 2).join(', ') || null,
    ]
      .filter(Boolean)
      .join(' · ')
    return [
      {
        mediaType: typeof r.media_type === 'string' ? r.media_type : mediaType,
        source: typeof r.source === 'string' ? r.source : 'tmdb',
        mediaId: String(r.media_id),
        title: r.title,
        image: localImageUrl(r.image, conn),
        releaseDate: typeof r.release_date === 'string' ? r.release_date : null,
        subtitle: subtitle || null,
      },
    ]
  })
}

/**
 * POST /api/v1/media/{type}/ with status 0 (Planning) = "add to watchlist" (verified live).
 * Returns the new tracking status.
 */
export async function addToWatchlist(conn: Connection, d: MediaDetail): Promise<number> {
  await createTracked(conn, d, { status: 0 })
  return 0
}

/**
 * POST /api/v1/media/{type}/ creates the tracked entry. Some types (board games) are rejected with
 * "progress: This field is required", so the call is retried once with progress 0.
 */
async function createTracked(conn: Connection, d: MediaDetail, fields: TrackingPatch): Promise<void> {
  const path = `/api/v1/media/${encodeURIComponent(d.mediaType)}/`
  const body = { source: d.source, media_id: d.mediaId, status: 0, ...fields }
  try {
    await request(conn, path, FEATURE_SCOPES.watchlist, { method: 'POST', body })
  } catch (e) {
    if (e instanceof ApiError && e.status === 400 && e.fields.includes('progress') && body.progress === undefined) {
      await request(conn, path, FEATURE_SCOPES.watchlist, { method: 'POST', body: { ...body, progress: 0 } })
      return
    }
    throw e
  }
}

/** DELETE /api/v1/media/{type}/{source}/{id}/ removes the tracked item AND all its history. */
export async function removeFromWatchlist(conn: Connection, d: MediaDetail): Promise<void> {
  await request(
    conn,
    `/api/v1/media/${encodeURIComponent(d.mediaType)}/${encodeURIComponent(d.source)}/${encodeURIComponent(d.mediaId)}/`,
    FEATURE_SCOPES.watchlist,
    { method: 'DELETE' },
  )
}

export interface TrackingPatch {
  status?: number
  /** 0-10, or null to clear. */
  score?: number | null
  progress?: number
  /** ISO date-time with a zone, or null to clear. */
  start_date?: string | null
  end_date?: string | null
  notes?: string
}

/**
 * Saves the user's tracking fields (verified live): POST creates the entry when the item isn't
 * tracked yet (Planning unless a status is given), PATCH updates it. Sending null clears a field.
 */
export async function updateTracking(
  conn: Connection,
  d: MediaDetail,
  patch: TrackingPatch,
  alreadyTracked: boolean,
): Promise<void> {
  if (!alreadyTracked) {
    await createTracked(conn, d, patch)
    return
  }
  await request(
    conn,
    `/api/v1/media/${encodeURIComponent(d.mediaType)}/${encodeURIComponent(d.source)}/${encodeURIComponent(d.mediaId)}/`,
    FEATURE_SCOPES.watchlist,
    { method: 'PATCH', body: patch },
  )
}

// ---- Tags, lists and Seerr (all verified against a live instance unless noted) ----

const itemPath = (d: Pick<MediaDetail, 'mediaType' | 'source' | 'mediaId'>) =>
  `/api/v1/media/${encodeURIComponent(d.mediaType)}/${encodeURIComponent(d.source)}/${encodeURIComponent(d.mediaId)}/`

export interface Tag {
  id: number
  name: string
}

/** GET /api/v1/tags/ → all of the user's tags. */
export async function fetchTags(conn: Connection): Promise<Tag[]> {
  const data = (await request(conn, '/api/v1/tags/', FEATURE_SCOPES.tagsRead)) as Json | null
  return (Array.isArray(data?.results) ? (data.results as Json[]) : []).flatMap((t): Tag[] =>
    typeof t.id === 'number' && typeof t.name === 'string' ? [{ id: t.id, name: t.name }] : [],
  )
}

/** POST /api/v1/tags/ {name} → the created tag. */
export async function createTag(conn: Connection, name: string): Promise<Tag> {
  const t = (await request(conn, '/api/v1/tags/', FEATURE_SCOPES.tagsWrite, { method: 'POST', body: { name } })) as Json | null
  if (typeof t?.id !== 'number') throw new Error('Floppy did not return the new tag')
  return { id: t.id, name: String(t.name ?? name) }
}

/** GET …/tags/ → ids of the tags on this item ([] when the item isn't tracked: Floppy answers 404). */
export async function fetchItemTags(conn: Connection, d: MediaDetail): Promise<number[]> {
  try {
    const data = (await request(conn, `${itemPath(d)}tags/`, FEATURE_SCOPES.tagsRead)) as Json | null
    return (Array.isArray(data?.results) ? (data.results as Json[]) : []).flatMap((t) => (typeof t.id === 'number' ? [t.id] : []))
  } catch (e) {
    if (e instanceof InsufficientScopeError) throw e
    return []
  }
}

/** PUT …/tags/ {tag_ids} replaces the item's tags. The item must already be tracked. */
export async function setItemTags(conn: Connection, d: MediaDetail, tagIds: number[]): Promise<void> {
  await request(conn, `${itemPath(d)}tags/`, FEATURE_SCOPES.tagsWrite, { method: 'PUT', body: { tag_ids: tagIds } })
}

export interface UserList {
  id: number
  name: string
  /** Smart lists fill themselves and externally managed lists (e.g. couchmoney) must not be edited by hand. */
  locked: boolean
}

/** GET /api/v1/lists/ → the user's lists. */
export async function fetchLists(conn: Connection): Promise<UserList[]> {
  const data = (await request(conn, '/api/v1/lists/?limit=100', FEATURE_SCOPES.listsRead)) as Json | null
  return (Array.isArray(data?.results) ? (data.results as Json[]) : []).flatMap((l): UserList[] =>
    typeof l.id === 'number' && typeof l.name === 'string'
      ? [{ id: l.id, name: l.name, locked: l.is_smart === true || /managed by/i.test(String(l.description ?? '')) }]
      : [],
  )
}

/** GET …/lists/ → ids of the lists containing this item (works for untracked items too). */
export async function fetchItemLists(conn: Connection, d: MediaDetail): Promise<number[]> {
  const data = (await request(conn, `${itemPath(d)}lists/`, FEATURE_SCOPES.listsRead)) as Json | null
  return (Array.isArray(data?.results) ? (data.results as Json[]) : []).flatMap((r) => (typeof r.list_id === 'number' ? [r.list_id] : []))
}

export async function addToList(conn: Connection, d: MediaDetail, listId: number): Promise<void> {
  await request(conn, `${itemPath(d)}lists/${listId}/`, FEATURE_SCOPES.listsWrite, { method: 'PUT' })
}

export async function removeFromList(conn: Connection, d: MediaDetail, listId: number): Promise<void> {
  await request(conn, `${itemPath(d)}lists/${listId}/`, FEATURE_SCOPES.listsWrite, { method: 'DELETE' })
}

export interface SeerrSeason {
  number: number
  name: string
  status: string
  requestable: boolean
}

export interface SeerrState {
  /** unknown | pending | processing | partially_available | available (Jellyseerr's own words) */
  status: string
  requestable: boolean
  url: string | null
  seasons: SeerrSeason[]
}

/**
 * GET …/request/ → the title's state in Seerr, or null when Seerr isn't configured / reachable
 * (Floppy answers 404 "Seerr is not available."). Only a missing permission is surfaced.
 */
export async function fetchSeerr(conn: Connection, d: MediaDetail): Promise<SeerrState | null> {
  try {
    const r = (await request(conn, `${itemPath(d)}request/`, FEATURE_SCOPES.seerrRead)) as Json | null
    if (!r || typeof r.status !== 'string') return null
    return {
      status: r.status,
      requestable: r.requestable === true,
      url: typeof r.seerr_url === 'string' ? r.seerr_url : null,
      seasons: (Array.isArray(r.seasons) ? (r.seasons as Json[]) : []).flatMap((s): SeerrSeason[] =>
        typeof s.number === 'number'
          ? [{ number: s.number, name: String(s.name ?? `Season ${s.number}`), status: String(s.status ?? 'unknown'), requestable: s.requestable === true }]
          : [],
      ),
    }
  } catch (e) {
    if (e instanceof InsufficientScopeError) throw e
    return null
  }
}

/**
 * POST …/request/ asks Seerr for the title: all seasons, or only `seasons` (TV).
 * NOT verified live: a real request starts downloads in the user's Seerr, so it was never sent in
 * testing; the body follows Floppy's description ("all seasons, or the listed `seasons`").
 */
export async function requestInSeerr(conn: Connection, d: MediaDetail, seasons?: number[]): Promise<void> {
  await request(conn, `${itemPath(d)}request/`, FEATURE_SCOPES.seerrWrite, {
    method: 'POST',
    body: seasons?.length ? { seasons } : {},
  })
}

/**
 * GET /api/v1/media/tv/{source}/{id}/{season}/{episode}/ → one episode, in the same shape as a
 * show (title, still in `image`, synopsis, `details.air_date/runtime/guest_stars/crew`, your history).
 * Anime episodes live in the Anime library, hence the library param.
 */
export function fetchEpisodeDetail(
  conn: Connection,
  mediaType: string,
  source: string,
  mediaId: string,
  season: string,
  episode: string,
): Promise<MediaDetail> {
  const lib = mediaType === 'anime' ? '?library_media_type=anime' : ''
  const path = `/api/v1/media/tv/${encodeURIComponent(source)}/${encodeURIComponent(mediaId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}/${lib}`
  return fetchMediaDetail(conn, 'tv', source, mediaId, path)
}
