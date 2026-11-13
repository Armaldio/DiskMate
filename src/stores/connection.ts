import { computed, ref } from 'vue'
import { LEGACY_SCOPES, REQUIRED_SCOPES } from '../api/scopes'

const KEY = 'diskmate.connection'

export interface Connection {
  baseUrl: string
  token: string
  /** Permissions the user was told to grant when this token was set up. */
  scopes?: string[]
}

function load(): Connection | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Connection) : null
  } catch {
    return null
  }
}

const connection = ref<Connection | null>(load())
/** Scopes a request reported as missing (403) this session. */
const reportedMissing = ref<string[]>([])

const missingScopes = computed(() => {
  if (!connection.value) return []
  const granted = new Set(connection.value.scopes ?? LEGACY_SCOPES)
  const need = new Set([...REQUIRED_SCOPES, ...reportedMissing.value])
  return [...need].filter((s) => reportedMissing.value.includes(s) || !granted.has(s)).sort()
})

export function normalizeUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`
  return u
}

export function useConnection() {
  return {
    connection,
    missingScopes,
    reportMissingScopes(scopes: string[]) {
      reportedMissing.value = [...new Set([...reportedMissing.value, ...scopes])]
    },
    isConnected: computed(() => connection.value !== null),
    save(c: Connection) {
      connection.value = {
        baseUrl: normalizeUrl(c.baseUrl),
        token: c.token.trim(),
        scopes: [...REQUIRED_SCOPES],
      }
      reportedMissing.value = []
      localStorage.setItem(KEY, JSON.stringify(connection.value))
    },
    clear() {
      connection.value = null
      localStorage.removeItem(KEY)
    },
  }
}
