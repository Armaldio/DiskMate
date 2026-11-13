/** One accent colour per media type, used by <MediaIcon> and anywhere a type needs identifying. */
export const MEDIA_COLORS: Record<string, string> = {
  every: '#7c8cff',
  movie: '#ff6b6b',
  tv: '#4dabf7',
  season: '#4dabf7',
  episode: '#4dabf7',
  anime: '#f783ac',
  manga: '#b197fc',
  game: '#51cf66',
  book: '#ffa94d',
  comic: '#ffd43b',
  comicissue: '#ffd43b',
  boardgame: '#3bc9db',
  podcast: '#da77f2',
  music: '#69db7c',
  video: '#ff8787',
}

export const mediaColor = (type: string): string => MEDIA_COLORS[type] ?? '#8b8d9c'
