/**
 * Every Floppy permission DiskMate uses, grouped by feature.
 * When you add a feature that needs a new permission, add it here (and pass it to
 * `request()` in floppy.ts): connected users then get a banner asking for a new token.
 */
export const FEATURE_SCOPES = {
  connection: ['user:read'],
  discover: ['catalog:read'],
  // future, e.g.: tracking: ['watchlist:read', 'watchlist:write', 'progress:read', 'progress:write'],
} as const satisfies Record<string, readonly string[]>

export const REQUIRED_SCOPES: string[] = [...new Set(Object.values(FEATURE_SCOPES).flat())].sort()

/** Scopes assumed for connections saved before scopes were tracked (the first release's set). */
export const LEGACY_SCOPES = ['catalog:read', 'user:read']

export class InsufficientScopeError extends Error {
  constructor(public scopes: string[]) {
    super(`Your token is missing permissions: ${scopes.join(', ')}`)
  }
}
