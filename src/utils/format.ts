/** Small formatting helpers for detail pages. All accept `unknown` (Floppy's `details` is untyped). */

/** Non-empty string, or null. */
export const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

/** Finite number, or null. */
export const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/** "1989-12-17T00:00:00+01:00", "2026-03-19" or "2012" → a long date in the browser's locale ("2012" stays a year). */
export function fmtDate(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  if (/^\d{4}$/.test(s)) return s
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { dateStyle: 'long' })
}

/** An array of strings (or of `{ name }` objects) → "A, B, C"; a plain string passes through. */
export function fmtList(v: unknown, max = 6): string | null {
  if (typeof v === 'string') return str(v)
  if (!Array.isArray(v)) return null
  const names = v
    .map((x) => (typeof x === 'string' ? x : str((x as Record<string, unknown> | null)?.name)))
    .filter((x): x is string => !!x)
  if (!names.length) return null
  return names.slice(0, max).join(', ') + (names.length > max ? ` +${names.length - max}` : '')
}

/** 90000 seconds → "25h"; 5400 → "1h 30m". */
export function fmtDuration(seconds: unknown): string | null {
  const n = num(seconds)
  if (n == null || n <= 0) return null
  const h = Math.floor(n / 3600)
  const m = Math.round((n % 3600) / 60)
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

/** 1234567 → "1,234,567" in the browser's locale. */
export const fmtNumber = (v: unknown): string | null => {
  const n = num(v)
  return n == null ? null : n.toLocaleString()
}
