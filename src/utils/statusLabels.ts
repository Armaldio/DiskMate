/**
 * Floppy has one set of tracking statuses (0 Planning, 1 In progress, 2 Paused, 3 Completed,
 * 4 Dropped). What they mean to a person depends on the media: you put a film on a watchlist,
 * but a game in a backlog, a board game on a wishlist and a book on a reading list.
 */
export interface TrackingWords {
  /** Labels for statuses 0..4 (status 0 is the "saved for later" one). */
  statuses: [string, string, string, string, string]
  /** The place it's saved to: "watchlist", "backlog"… */
  list: string
  /** Button text when not tracked, and when it is a pure Planning entry. */
  add: string
  on: string
}

const make = (list: string, on: string, statuses: TrackingWords['statuses']): TrackingWords => ({
  statuses,
  list,
  add: `Add to ${list}`,
  on,
})

const WATCH = make('watchlist', 'On your watchlist', ['Watchlist', 'Watching', 'Paused', 'Watched', 'Dropped'])
const READ = make('reading list', 'On your reading list', ['Want to read', 'Reading', 'Paused', 'Read', 'Dropped'])
const LISTEN = make('listen list', 'On your listen list', ['Want to listen', 'Listening', 'Paused', 'Listened', 'Dropped'])

const BY_TYPE: Record<string, TrackingWords> = {
  movie: WATCH,
  tv: WATCH,
  season: WATCH,
  episode: WATCH,
  anime: WATCH,
  video: WATCH,
  game: make('backlog', 'In your backlog', ['Backlog', 'Playing', 'Paused', 'Played', 'Dropped']),
  boardgame: make('wishlist', 'On your wishlist', ['Wishlist', 'Playing', 'Paused', 'Played', 'Dropped']),
  book: READ,
  manga: READ,
  comic: READ,
  comicissue: READ,
  podcast: LISTEN,
  music: LISTEN,
}

export const trackingWords = (mediaType: string): TrackingWords => BY_TYPE[mediaType] ?? WATCH
